import { pool } from "@/lib/db";

// Vendor master — reads from SML ap_supplier + odg_ap_balance (payables) + ic_trans
// (purchase history). No new tables; PO/purchase link is ic_trans.cust_code = ap_supplier.code.

export type VendorRow = {
  code: string;
  name: string;
  name_eng: string;
  tel: string;
  province: string;
  ap_type: string;
  status: string;
  ap_outstanding: string; // sum of open payables
  overdue: number; // count of overdue payable docs
};

export async function listVendors(opts: { q?: string; limit?: number; offset?: number }): Promise<VendorRow[]> {
  const q = (opts.q ?? "").trim();
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = Math.max(0, opts.offset ?? 0);
  const params: unknown[] = [];
  const where: string[] = ["COALESCE(s.name_1,'') <> ''"];
  if (q) {
    params.push(`%${q}%`);
    where.push(`(s.code ILIKE $${params.length} OR s.name_1 ILIKE $${params.length} OR s.name_eng_1 ILIKE $${params.length} OR s.telephone ILIKE $${params.length})`);
  }
  const { rows } = await pool.query<VendorRow>(
    `SELECT s.code,
            COALESCE(s.name_1,'') AS name,
            COALESCE(s.name_eng_1,'') AS name_eng,
            COALESCE(s.telephone,'') AS tel,
            COALESCE(s.province,'') AS province,
            COALESCE(s.ap_type,'') AS ap_type,
            COALESCE(s.status::text,'') AS status,
            COALESCE(ap.outstanding,0)::text AS ap_outstanding,
            COALESCE(ap.overdue,0)::int AS overdue
       FROM ap_supplier s
       LEFT JOIN LATERAL (
         SELECT SUM(b.balance_amount) AS outstanding,
                count(*) FILTER (WHERE COALESCE(b.overdue_day,0) > 0) AS overdue
           FROM odg_ap_balance b
          WHERE b.ap_code = s.code AND COALESCE(b.balance_amount,0) > 0
       ) ap ON true
      WHERE ${where.join(" AND ")}
      ORDER BY s.name_1
      LIMIT ${limit} OFFSET ${offset}`,
    params,
  );
  return rows;
}

export type VendorDetail = {
  code: string;
  name: string;
  name_eng: string;
  address: string;
  tambon: string;
  amper: string;
  province: string;
  tel: string;
  fax: string;
  email: string;
  website: string;
  ap_type: string;
  status: string;
  remark: string;
};

export type VendorPayable = {
  doc_no: string;
  doc_date: string | null;
  due_date: string | null;
  amount: string;
  balance: string;
  overdue_day: number;
  doc_type_name: string;
};

export type VendorPo = {
  doc_no: string;
  format: string;
  doc_date: string | null;
  total_amount: string;
  currency_code: string;
  lines: number;
};

export type VendorStats = {
  po_count: number;
  po_total: string; // total PO value (approved + all)
  last_po_date: string | null;
  ap_outstanding: string;
  ap_overdue: string;
};

export async function getVendor(code: string): Promise<{
  vendor: VendorDetail;
  stats: VendorStats;
  payables: VendorPayable[];
  pos: VendorPo[];
} | null> {
  const head = await pool.query<VendorDetail>(
    `SELECT s.code,
            COALESCE(s.name_1,'') AS name, COALESCE(s.name_eng_1,'') AS name_eng,
            COALESCE(s.address,'') AS address, COALESCE(s.tambon,'') AS tambon,
            COALESCE(s.amper,'') AS amper, COALESCE(s.province,'') AS province,
            COALESCE(s.telephone,'') AS tel, COALESCE(s.fax,'') AS fax,
            COALESCE(s.email,'') AS email, COALESCE(s.website,'') AS website,
            COALESCE(s.ap_type,'') AS ap_type, COALESCE(s.status::text,'') AS status,
            COALESCE(s.remark,'') AS remark
       FROM ap_supplier s WHERE s.code = $1`,
    [code],
  );
  if (!head.rowCount) return null;

  const [stats, payables, pos] = await Promise.all([
    pool.query<VendorStats>(
      `SELECT (SELECT count(*)::int FROM ic_trans t WHERE t.cust_code = $1 AND t.trans_flag = 6) AS po_count,
              (SELECT COALESCE(SUM(t.total_amount),0) FROM ic_trans t WHERE t.cust_code = $1 AND t.trans_flag = 6)::text AS po_total,
              (SELECT MAX(t.doc_date) FROM ic_trans t WHERE t.cust_code = $1 AND t.trans_flag = 6)::text AS last_po_date,
              (SELECT COALESCE(SUM(b.balance_amount),0) FROM odg_ap_balance b WHERE b.ap_code = $1 AND COALESCE(b.balance_amount,0) > 0)::text AS ap_outstanding,
              (SELECT COALESCE(SUM(b.balance_amount),0) FROM odg_ap_balance b WHERE b.ap_code = $1 AND COALESCE(b.balance_amount,0) > 0 AND COALESCE(b.overdue_day,0) > 0)::text AS ap_overdue`,
      [code],
    ),
    pool.query<VendorPayable>(
      `SELECT COALESCE(doc_no,'') AS doc_no, doc_date::text AS doc_date, due_date::text AS due_date,
              COALESCE(amount,0)::text AS amount, COALESCE(balance_amount,0)::text AS balance,
              COALESCE(overdue_day,0)::int AS overdue_day, COALESCE(doc_type_name,'') AS doc_type_name
         FROM odg_ap_balance
        WHERE ap_code = $1 AND COALESCE(balance_amount,0) > 0
        -- due_date is text in DD-MM-YYYY; parse it so the sort is chronological
        ORDER BY to_date(NULLIF(due_date,''),'DD-MM-YYYY') NULLS LAST
        LIMIT 50`,
      [code],
    ),
    pool.query<VendorPo>(
      `SELECT t.doc_no, t.doc_format_code AS format, t.doc_date::text AS doc_date,
              COALESCE(t.total_amount,0)::text AS total_amount, COALESCE(t.currency_code,'') AS currency_code,
              (SELECT count(*)::int FROM ic_trans_detail d WHERE d.doc_no = t.doc_no AND d.trans_flag = 6) AS lines
         FROM ic_trans t
        WHERE t.cust_code = $1 AND t.trans_flag = 6 AND t.doc_format_code IN ('POH','POT')
        ORDER BY t.doc_date DESC NULLS LAST, t.doc_no DESC
        LIMIT 20`,
      [code],
    ),
  ]);

  return {
    vendor: head.rows[0],
    stats: stats.rows[0],
    payables: payables.rows,
    pos: pos.rows,
  };
}
