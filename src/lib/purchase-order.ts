import type { PoolClient } from "pg";
import { pool } from "./db";

// ===== Purchase Order (PO) — SML ic_trans, trans_flag = 6, doc_format POH/POT =====
// POH = branch "00" (head office), POT = branch "05". doc_no = <FMT><YY><MM><NNNN>,
// running number resets per month per format. roworder columns are sequences → never set.

export type PoFormat = "POH" | "POT";
export const PO_FORMATS: { code: PoFormat; label: string; branch: string }[] = [
  { code: "POH", label: "POH · ສຳນັກງານໃຫຍ່", branch: "00" },
  { code: "POT", label: "POT · ສາຂາ/ສ້ອມແປງ", branch: "05" },
];

export const PO_CURRENCIES: { code: string; label: string }[] = [
  { code: "01", label: "ບາດ (THB)" },
  { code: "02", label: "ກີບ (LAK)" },
  { code: "03", label: "ໂດລາ (USD)" },
  { code: "04", label: "ຢວນ (CNY)" },
];

// vat_type: 0 = ບໍ່ມີ, 1 = ແຍກນອກ, 2 = ລວມໃນ (SML convention)
export const PO_VAT_OPTIONS: { value: string; label: string; type: number; rate: number }[] = [
  { value: "none", label: "ບໍ່ມີ VAT", type: 0, rate: 0 },
  { value: "in10", label: "ລວມ VAT 10%", type: 2, rate: 10 },
  { value: "in7", label: "ລວມ VAT 7%", type: 2, rate: 7 },
  { value: "ex10", label: "ແຍກ VAT 10%", type: 1, rate: 10 },
];

export type PoListRow = {
  doc_no: string;
  format: string;
  doc_date: string | null;
  created_at: string | null; // create_datetime → live elapsed start
  completed_at: string | null; // last goods-receipt datetime → timer freezes here when fully received
  supplier_code: string;
  supplier_name: string;
  currency_code: string;
  total_amount: string;
  lines: number;
  approve_status: number;
  wf_status: string;
  receipt: string | null; // approved only: 'awaiting' | 'partial' | 'full'
  department_code: string;
  department_name: string;
  creator_name: string;
  remark: string;
};

export async function listPurchaseOrders(opts: {
  q?: string;
  status?: "all" | "pending" | "approved";
  mine?: string; // creator employee code → only this person's POs
  dept?: string; // department code → only this department's POs
  limit?: number;
}): Promise<PoListRow[]> {
  const q = (opts.q ?? "").trim();
  const limit = Math.min(opts.limit ?? 100, 300);
  const params: unknown[] = [];
  const where: string[] = ["t.trans_flag = 6", "t.doc_format_code IN ('POH','POT')"];

  if (q) {
    params.push(`%${q}%`);
    where.push(
      `(t.doc_no ILIKE $${params.length} OR t.cust_code ILIKE $${params.length} OR s.name_1 ILIKE $${params.length} OR t.remark ILIKE $${params.length})`,
    );
  }
  if (opts.mine) {
    params.push(opts.mine);
    where.push(`t.creator_code = $${params.length}`);
  }
  if (opts.dept) {
    params.push(opts.dept);
    where.push(`COALESCE(NULLIF(t.department_code,''), ce.department_code) = $${params.length}`);
  }
  if (opts.status === "pending") where.push("COALESCE(a.status,'draft') = 'pending'");
  if (opts.status === "approved") where.push("(a.status = 'approved' OR t.approve_status = 1)");

  const { rows } = await pool.query<PoListRow>(
    `SELECT t.doc_no,
            t.doc_format_code AS format,
            t.doc_date,
            COALESCE(t.cust_code,'') AS supplier_code,
            COALESCE(s.name_1, t.cust_code, '') AS supplier_name,
            COALESCE(t.currency_code,'') AS currency_code,
            COALESCE(t.total_amount,0)::text AS total_amount,
            COALESCE(t.approve_status,0) AS approve_status,
            COALESCE(a.status, CASE WHEN t.approve_status = 1 THEN 'approved' ELSE 'draft' END) AS wf_status,
            CASE
              WHEN COALESCE(a.status, CASE WHEN t.approve_status = 1 THEN 'approved' ELSE 'draft' END) <> 'approved' THEN NULL
              WHEN COALESCE(rc.recv,0) <= 0 THEN 'awaiting'
              WHEN rc.ord > 0 AND rc.recv >= rc.ord THEN 'full'
              ELSE 'partial'
            END AS receipt,
            COALESCE(t.create_datetime, t.create_date_time_now)::text AS created_at,
            rc.last_recv_at::text AS completed_at,
            COALESCE(NULLIF(t.department_code,''), ce.department_code, '') AS department_code,
            COALESCE(dp.department_name_lo, NULLIF(t.department_code,''), ce.department_code, '') AS department_name,
            COALESCE(ce.fullname_lo, t.creator_code, '') AS creator_name,
            COALESCE(t.remark,'') AS remark,
            (SELECT count(*)::int FROM ic_trans_detail d
              WHERE d.doc_no = t.doc_no AND d.trans_flag = 6) AS lines
       FROM ic_trans t
       LEFT JOIN ap_supplier s ON s.code = t.cust_code
       LEFT JOIN odg_pm_po_approval a ON a.doc_no = t.doc_no
       LEFT JOIN odg_employee ce ON ce.employee_code = t.creator_code
       LEFT JOIN odg_department dp ON dp.department_code = COALESCE(NULLIF(t.department_code,''), ce.department_code)
       LEFT JOIN LATERAL (
         SELECT
           (SELECT COALESCE(SUM(d.qty),0) FROM ic_trans_detail d
             WHERE d.doc_no = t.doc_no AND d.trans_flag = 6) AS ord,
           (SELECT COALESCE(SUM(gr.qty),0) FROM ic_trans_detail gr
             WHERE gr.trans_flag = 12 AND gr.ref_doc_no = t.doc_no AND gr.last_status = 0) AS recv,
           (SELECT MAX(COALESCE(gh.create_datetime, gh.create_date_time_now))
              FROM ic_trans_detail gr
              JOIN ic_trans gh ON gh.doc_no = gr.doc_no AND gh.trans_flag = 12
             WHERE gr.trans_flag = 12 AND gr.ref_doc_no = t.doc_no AND gr.last_status = 0) AS last_recv_at
       ) rc ON true
      WHERE ${where.join(" AND ")}
      ORDER BY t.doc_date DESC NULLS LAST, t.doc_no DESC
      LIMIT ${limit}`,
    params,
  );
  return rows;
}

// ===== PO ຄ້າງຮັບເຂົ້າ (outstanding to receive) — from odg_po_remain =====
// Aging buckets mirror stock aging: 0–30 / 31–90 / 91–180 / 181–360 / 360+ days.

export type PoRemainRow = {
  doc_no: string;
  doc_date: string | null;
  send_date: string | null;
  supplier_code: string;
  supplier_name: string;
  item_code: string;
  item_name: string;
  qty: string;
  qty_balance: string;
  unit: string;
  warehouse: string;
  currency_sign: string;
  aging_days: number;
};

export type PoRemainAging = {
  b0_30: number;
  b31_90: number;
  b91_180: number;
  b181_360: number;
  b360p: number;
  total_lines: number;
  total_docs: number;
  total_qty: string;
};

const REMAIN_BUCKETS: Record<string, string> = {
  b0_30: "age <= 30",
  b31_90: "age > 30 AND age <= 90",
  b91_180: "age > 90 AND age <= 180",
  b181_360: "age > 180 AND age <= 360",
  b360p: "age > 360",
};

export async function getPoRemainAging(q = ""): Promise<PoRemainAging> {
  const params: unknown[] = [];
  let filter = "";
  if (q.trim()) {
    params.push(`%${q.trim()}%`);
    filter = `AND (doc_no ILIKE $1 OR cust_name ILIKE $1 OR cust_code ILIKE $1 OR item_name ILIKE $1 OR item_code ILIKE $1)`;
  }
  const { rows } = await pool.query<PoRemainAging>(
    `WITH r AS (
       SELECT (CURRENT_DATE - doc_date) AS age, qty_balance, doc_no
         FROM odg_po_remain
        WHERE COALESCE(qty_balance,0) > 0 ${filter}
     )
     SELECT count(*) FILTER (WHERE age <= 30)::int AS b0_30,
            count(*) FILTER (WHERE age > 30 AND age <= 90)::int AS b31_90,
            count(*) FILTER (WHERE age > 90 AND age <= 180)::int AS b91_180,
            count(*) FILTER (WHERE age > 180 AND age <= 360)::int AS b181_360,
            count(*) FILTER (WHERE age > 360)::int AS b360p,
            count(*)::int AS total_lines,
            count(DISTINCT doc_no)::int AS total_docs,
            COALESCE(sum(qty_balance),0)::text AS total_qty
       FROM r`,
    params,
  );
  return rows[0];
}

export async function listPoRemain(opts: {
  q?: string;
  bucket?: string;
  limit?: number;
}): Promise<PoRemainRow[]> {
  const q = (opts.q ?? "").trim();
  const limit = Math.min(opts.limit ?? 200, 500);
  const params: unknown[] = [];
  const where: string[] = ["COALESCE(qty_balance,0) > 0"];
  if (q) {
    params.push(`%${q}%`);
    where.push(
      `(doc_no ILIKE $${params.length} OR cust_name ILIKE $${params.length} OR cust_code ILIKE $${params.length} OR item_name ILIKE $${params.length} OR item_code ILIKE $${params.length})`,
    );
  }
  const bucketCond = opts.bucket ? REMAIN_BUCKETS[opts.bucket] : undefined;
  const having = bucketCond ? `AND ${bucketCond.replace(/age/g, "(CURRENT_DATE - doc_date)")}` : "";

  const { rows } = await pool.query<PoRemainRow>(
    `SELECT doc_no,
            doc_date,
            send_date,
            COALESCE(cust_code,'') AS supplier_code,
            COALESCE(cust_name, cust_code, '') AS supplier_name,
            COALESCE(item_code,'') AS item_code,
            COALESCE(item_name,'') AS item_name,
            COALESCE(qty,0)::text AS qty,
            COALESCE(qty_balance,0)::text AS qty_balance,
            COALESCE(NULLIF(unit_name,''), unit_code, '') AS unit,
            COALESCE(warehouse,'') AS warehouse,
            COALESCE(currency_sign,'') AS currency_sign,
            (CURRENT_DATE - doc_date)::int AS aging_days
       FROM odg_po_remain
      WHERE ${where.join(" AND ")} ${having}
      ORDER BY doc_date ASC NULLS LAST, doc_no
      LIMIT ${limit}`,
    params,
  );
  return rows;
}

export type PoItemOption = {
  code: string;
  name: string;
  unit: string;
  price: number; // latest purchase price (last buy), fallback average cost
  last_buy_date: string | null;
  stand_value: number;
  divide_value: number;
  balance: number; // current on-hand stock
  max_qty: number | null; // admin-set max stock (null = not set)
  dii_actual: number | null; // brand months-of-stock right now (null = no sales/policy)
  dii_target: number | null; // brand DII policy target from odg_stock_policy
};

// Item picker for PO lines — autofills the latest purchase price (ລາຄາຊື້ລ້າສຸດ)
// from odg_stock_aging.last_buy_price, falling back to average cost.
export async function searchPoItems(q: string, limit = 20): Promise<PoItemOption[]> {
  const term = q.trim();
  if (!term) return [];
  const { rows } = await pool.query<{
    code: string;
    name: string;
    unit: string;
    price: string;
    last_buy_date: string | null;
    stand_value: string;
    divide_value: string;
    balance: string;
    max_qty: string | null;
    dii_actual: string | null;
    dii_target: string | null;
  }>(
    `SELECT i.code,
            i.name_1 AS name,
            COALESCE(NULLIF(i.unit_standard_name,''), i.unit_standard, '') AS unit,
            COALESCE(lb.price, i.average_cost, 0)::text AS price,
            lb.doc_date::text AS last_buy_date,
            COALESCE(NULLIF(i.unit_standard_stand_value,0), 1)::text AS stand_value,
            COALESCE(NULLIF(i.unit_standard_divide_value,0), 1)::text AS divide_value,
            COALESCE(i.balance_qty,0)::text AS balance,
            ms.max_qty::text AS max_qty,
            bd.dii_actual::text AS dii_actual,
            (sp.sale_months + sp.stock_months)::text AS dii_target
       FROM ic_inventory i
       LEFT JOIN odg_min_stock_setting ms ON ms.item_code = i.code
       LEFT JOIN odg_stock_policy sp
              ON sp.group_main = i.group_main
             AND sp.brand = UPPER(COALESCE(i.item_brand,''))
             AND sp.supplier_name = ''
       LEFT JOIN LATERAL (
         SELECT d.price, d.doc_date
           FROM ic_trans_detail d
          WHERE d.item_code = i.code AND d.trans_flag = 12 AND d.last_status = 0 AND d.price > 0
          ORDER BY d.doc_date DESC NULLS LAST, d.doc_no DESC
          LIMIT 1
       ) lb ON true
       LEFT JOIN LATERAL (
         SELECT ROUND(SUM(COALESCE(x.balance_qty,0)) / NULLIF(SUM(COALESCE(a.avgsale,0)), 0), 1) AS dii_actual
           FROM ic_inventory x
           LEFT JOIN odg_stock_aging a ON a.ic_code = x.code
          WHERE x.group_main = i.group_main
            AND UPPER(COALESCE(x.item_brand,'')) = UPPER(COALESCE(i.item_brand,''))
       ) bd ON sp.id IS NOT NULL
      WHERE i.code ILIKE $1 OR i.name_1 ILIKE $1 OR i.name_eng_1 ILIKE $1
      ORDER BY i.code
      LIMIT ${limit}`,
    [`%${term}%`],
  );
  return rows.map((r) => ({
    code: r.code,
    name: r.name,
    unit: r.unit,
    price: Number(r.price) || 0,
    last_buy_date: r.last_buy_date,
    stand_value: Number(r.stand_value) || 1,
    divide_value: Number(r.divide_value) || 1,
    balance: Number(r.balance) || 0,
    max_qty: r.max_qty != null ? Number(r.max_qty) : null,
    dii_actual: r.dii_actual != null ? Number(r.dii_actual) : null,
    dii_target: r.dii_target != null ? Number(r.dii_target) : null,
  }));
}

export async function getWarehouses(): Promise<{ code: string; name: string }[]> {
  const { rows } = await pool.query<{ code: string; name: string }>(
    `SELECT code, COALESCE(name_1, code) AS name FROM ic_warehouse WHERE code <> '' ORDER BY code`,
  );
  return rows;
}

export async function getEmployeeDepartment(employeeCode: string): Promise<string> {
  const { rows } = await pool.query<{ department_code: string | null }>(
    `SELECT department_code FROM odg_employee WHERE employee_code = $1`,
    [employeeCode],
  );
  return rows[0]?.department_code ?? "";
}

export async function getDepartments(): Promise<{ code: string; name: string }[]> {
  const { rows } = await pool.query<{ code: string; name: string }>(
    `SELECT department_code AS code, COALESCE(department_name_lo, department_code) AS name
       FROM odg_department WHERE department_code <> '' ORDER BY department_code`,
  );
  return rows;
}

// ===== Purchase Request (PR) → PO: approved PRs with outstanding qty (odg_pr_remain) =====
export type PrOption = { doc_no: string; supplier_code: string; supplier_name: string; lines: number };

export async function searchApprovedPr(q: string, limit = 20): Promise<PrOption[]> {
  const term = q.trim();
  if (!term) return [];
  const { rows } = await pool.query<PrOption>(
    `SELECT r.doc_no,
            COALESCE(r.cust_code,'') AS supplier_code,
            COALESCE(r.cust_name, r.cust_code, '') AS supplier_name,
            count(*)::int AS lines
       FROM odg_pr_remain r
      WHERE COALESCE(r.qty_balance,0) > 0
        AND (r.doc_no ILIKE $1 OR r.cust_name ILIKE $1 OR r.item_name ILIKE $1 OR r.item_code ILIKE $1)
      GROUP BY r.doc_no, r.cust_code, r.cust_name
      ORDER BY r.doc_no DESC
      LIMIT ${limit}`,
    [`%${term}%`],
  );
  return rows;
}

export type PrImportLine = {
  item_code: string;
  item_name: string;
  unit: string;
  qty: string; // outstanding qty (qty_balance)
  price: string;
  ref_line: number;
};
export type PrImport = {
  supplier_code: string;
  supplier_name: string;
  lines: PrImportLine[];
};

export async function getPrImportLines(prNo: string): Promise<PrImport | null> {
  const { rows } = await pool.query<PrImportLine & { supplier_code: string; supplier_name: string }>(
    `SELECT r.item_code,
            COALESCE(r.item_name,'') AS item_name,
            COALESCE(NULLIF(r.unit_name,''), '') AS unit,
            COALESCE(r.qty_balance,0)::text AS qty,
            COALESCE(r.price,0)::text AS price,
            COALESCE(r.cust_code,'') AS supplier_code,
            COALESCE(r.cust_name, r.cust_code, '') AS supplier_name,
            COALESCE((SELECT MIN(d.line_number) FROM ic_trans_detail d
                       WHERE d.doc_no = r.doc_no AND d.item_code = r.item_code), 0) AS ref_line
       FROM odg_pr_remain r
      WHERE r.doc_no = $1 AND COALESCE(r.qty_balance,0) > 0
      ORDER BY r.item_code`,
    [prNo],
  );
  if (rows.length === 0) return null;
  return {
    supplier_code: rows[0].supplier_code,
    supplier_name: rows[0].supplier_name,
    lines: rows.map((r) => ({
      item_code: r.item_code,
      item_name: r.item_name,
      unit: r.unit,
      qty: r.qty,
      price: r.price,
      ref_line: Number(r.ref_line) || 0,
    })),
  };
}

export type PoLineInput = {
  item_code: string;
  item_name: string;
  unit: string;
  qty: number;
  price: number;
  wh_code: string;
  stand_value: number;
  divide_value: number;
  ref_doc_no?: string; // source PR doc_no (when created from a PR)
  ref_line?: number;
};

export type CreatePoInput = {
  format: PoFormat;
  supplier_code: string;
  currency_code: string;
  exchange_rate: number;
  vat: string; // key into PO_VAT_OPTIONS
  wh_code: string;
  department_code: string;
  eta: string; // expected receive date (send_date), yyyy-mm-dd or ""
  credit_day: number;
  remark: string;
  lines: PoLineInput[];
};

function two(n: number) {
  return String(n).padStart(2, "0");
}

// Reserve the next doc_no for a format+month under an advisory lock (per format+month).
async function nextDocNo(client: PoolClient, format: PoFormat): Promise<string> {
  const now = new Date();
  const yy = two(now.getFullYear() % 100);
  const mm = two(now.getMonth() + 1);
  const prefix = `${format}${yy}${mm}`; // 7 chars, e.g. POH2607
  // Serialise number generation across app sessions for this format+month.
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [prefix]);
  const { rows } = await client.query<{ next: number }>(
    `SELECT COALESCE(MAX(RIGHT(doc_no, 4)::int), 0) + 1 AS next
       FROM ic_trans
      WHERE trans_flag = 6 AND doc_no LIKE $1 AND LENGTH(doc_no) = 11`,
    [`${prefix}%`],
  );
  const running = String(rows[0]?.next ?? 1).padStart(4, "0");
  return `${prefix}${running}`;
}

export type CreatePoResult = { ok: true; doc_no: string } | { ok: false; error: string };

// Writes a PO directly into SML ic_trans (header) + ic_trans_detail (lines),
// approve_status = 0 (ລໍຖ້າອະນຸມັດ). Wrapped in one transaction.
export async function createPurchaseOrder(
  input: CreatePoInput,
  user: { employeeCode: string },
): Promise<CreatePoResult> {
  const fmt = PO_FORMATS.find((f) => f.code === input.format);
  if (!fmt) return { ok: false, error: "ຮູບແບບ PO ບໍ່ຖືກຕ້ອງ" };
  if (!input.supplier_code) return { ok: false, error: "ຕ້ອງເລືອກຜູ້ສະໜອງ" };
  const lines = input.lines.filter((l) => l.item_code && l.qty > 0);
  if (lines.length === 0) return { ok: false, error: "ຕ້ອງມີລາຍການສິນຄ້າຢ່າງໜ້ອຍ 1 ລາຍການ" };

  const vat = PO_VAT_OPTIONS.find((v) => v.value === input.vat) ?? PO_VAT_OPTIONS[0];
  const subtotal = lines.reduce((s, l) => s + l.qty * l.price, 0);
  // VAT split: type 2 = included in price, type 1 = added on top, 0 = none.
  let totalBeforeVat = subtotal;
  let totalVat = 0;
  let totalAmount = subtotal;
  if (vat.type === 2 && vat.rate > 0) {
    totalBeforeVat = subtotal / (1 + vat.rate / 100);
    totalVat = subtotal - totalBeforeVat;
    totalAmount = subtotal;
  } else if (vat.type === 1 && vat.rate > 0) {
    totalBeforeVat = subtotal;
    totalVat = subtotal * (vat.rate / 100);
    totalAmount = subtotal + totalVat;
  }
  const round2 = (n: number) => Math.round(n * 100) / 100;

  const now = new Date();
  const hh = two(now.getHours());
  const mi = two(now.getMinutes());
  const docTime = `${hh}:${mi}`;

  const client = await pool.connect();
  try {
    // Retry loop guards against a doc_no race with the ERP's own numbering.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await client.query("BEGIN");
        const docNo = await nextDocNo(client, input.format);

        await client.query(
          `INSERT INTO ic_trans
             (trans_type, trans_flag, doc_format_code, doc_no, doc_date, doc_time,
              cust_code, branch_code, currency_code, exchange_rate,
              vat_type, vat_rate, total_value, total_before_vat, total_vat_value,
              total_amount, remark, creator_code, user_request,
              send_date, delivery_date, want_date, credit_day, department_code,
              create_datetime, create_date_time_now,
              approve_status, status, last_status, used_status, doc_success)
           VALUES
             (1, 6, $1, $2, CURRENT_DATE, $3,
              $4, $5, $6, $7,
              $8, $9, $10, $11, $12,
              $13, $14, $15, $15,
              NULLIF($16,'')::date, NULLIF($16,'')::date, NULLIF($16,'')::date, $17,
              COALESCE(NULLIF($18,''), (SELECT department_code FROM odg_employee WHERE employee_code = $15)),
              CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
              0, 0, 0, 0, 0)`,
          [
            input.format,
            docNo,
            docTime,
            input.supplier_code,
            fmt.branch,
            input.currency_code,
            input.exchange_rate,
            vat.type,
            vat.rate,
            round2(subtotal),
            round2(totalBeforeVat),
            round2(totalVat),
            round2(totalAmount),
            input.remark || null,
            user.employeeCode,
            input.eta || "",
            input.credit_day || 0,
            input.department_code || "",
          ],
        );

        await client.query(
          `INSERT INTO odg_pm_po_approval (doc_no, status, created_by)
           VALUES ($1, 'draft', $2)
           ON CONFLICT (doc_no) DO NOTHING`,
          [docNo, user.employeeCode],
        );

        let line = 0;
        for (const l of lines) {
          const lineAmount = round2(l.qty * l.price);
          await client.query(
            `INSERT INTO ic_trans_detail
               (trans_type, trans_flag, doc_no, doc_date, doc_time, line_number,
                cust_code, item_code, item_name, unit_code, qty, price, sum_amount,
                wh_code, branch_code, calc_flag, vat_type,
                stand_value, divide_value, ref_doc_no, ref_line_number,
                status, last_status, create_date_time_now)
             VALUES
               (1, 6, $1, CURRENT_DATE, $2, $3,
                $4, $5, $6, $7, $8, $9, $10,
                $11, $12, 1, $13,
                $14, $15, NULLIF($16,''), $17,
                0, 0, CURRENT_TIMESTAMP)`,
            [
              docNo,
              docTime,
              line,
              input.supplier_code,
              l.item_code,
              l.item_name,
              l.unit,
              l.qty,
              l.price,
              lineAmount,
              l.wh_code || input.wh_code || null,
              fmt.branch,
              vat.type,
              l.stand_value || 1,
              l.divide_value || 1,
              l.ref_doc_no || "",
              l.ref_line ?? 0,
            ],
          );
          line++;
        }

        await client.query("COMMIT");
        return { ok: true, doc_no: docNo };
      } catch (err) {
        await client.query("ROLLBACK");
        // 23505 = unique_violation on (doc_no, trans_flag) → retry with a fresh number.
        if ((err as { code?: string }).code === "23505" && attempt < 4) continue;
        throw err;
      }
    }
    return { ok: false, error: "ບໍ່ສາມາດອອກເລກ PO ໄດ້ (ຊ້ຳກັນ), ລອງໃໝ່ອີກຄັ້ງ" };
  } finally {
    client.release();
  }
}

// ===== PO detail + approval workflow (WPOA) + attachments =====

export type PoApproval = {
  status: "draft" | "pending" | "approved" | "rejected";
  wpoa_no: string | null;
  poa_no: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  reject_reason: string | null;
};

export type PoAttachment = {
  id: number;
  doc_no: string;
  kind: string;
  file_name: string;
  file_path: string;
  content_type: string | null;
  size_bytes: string | null;
  uploaded_by: string;
  uploaded_at: string;
};

export type PoHeader = {
  doc_no: string;
  format: string;
  branch_code: string;
  doc_date: string | null;
  supplier_code: string;
  supplier_name: string;
  currency_code: string;
  exchange_rate: string;
  vat_type: number;
  vat_rate: string;
  total_value: string;
  total_before_vat: string;
  total_vat_value: string;
  total_amount: string;
  remark: string;
  creator_code: string;
  approve_status: number;
  eta: string | null;
  credit_day: number;
  branch_name: string;
  created_at: string | null;
};

export type PoLine = {
  line_number: number;
  item_code: string;
  item_name: string;
  unit: string;
  qty: string;
  price: string;
  sum_amount: string;
  wh_code: string;
  wh_name: string;
  received: string; // qty received via goods-receipt (PUI, flag 12)
  pui: string | null; // PUI doc numbers, comma-separated
  last_buy_price: string; // latest historical purchase price for this item
  last_buy_date: string | null;
  ref_pr: string; // source PR doc_no (ref_doc_no), when created from a PR
};

export type PoReceipt = {
  pui: string; // GR doc_no (PUI)
  doc_date: string | null;
  created_at: string | null;
  ref_line: number;
  item_code: string;
  item_name: string;
  qty: string;
  unit: string;
  wh_code: string;
  wh_name: string;
};

export type PoPayable = {
  has_ap: boolean;
  amount: string;
  balance: string; // outstanding to pay
  overdue_day: number;
  docs: string | null; // AP doc numbers (e.g. PUIH...)
};

export type PoDetail = {
  header: PoHeader;
  lines: PoLine[];
  receipts: PoReceipt[];
  payable: PoPayable;
  approval: PoApproval;
  attachments: PoAttachment[];
} | null;

export async function getPurchaseOrder(docNo: string): Promise<PoDetail> {
  const { rows: hrows } = await pool.query<PoHeader>(
    `SELECT t.doc_no,
            t.doc_format_code AS format,
            COALESCE(t.branch_code,'') AS branch_code,
            t.doc_date,
            COALESCE(t.cust_code,'') AS supplier_code,
            COALESCE(s.name_1, t.cust_code, '') AS supplier_name,
            COALESCE(t.currency_code,'') AS currency_code,
            COALESCE(t.exchange_rate,1)::text AS exchange_rate,
            COALESCE(t.vat_type,0) AS vat_type,
            COALESCE(t.vat_rate,0)::text AS vat_rate,
            COALESCE(t.total_value,0)::text AS total_value,
            COALESCE(t.total_before_vat,0)::text AS total_before_vat,
            COALESCE(t.total_vat_value,0)::text AS total_vat_value,
            COALESCE(t.total_amount,0)::text AS total_amount,
            COALESCE(t.remark,'') AS remark,
            COALESCE(t.creator_code,'') AS creator_code,
            COALESCE(t.approve_status,0) AS approve_status,
            t.send_date::text AS eta,
            COALESCE(t.credit_day,0) AS credit_day,
            COALESCE(b.name_1, t.branch_code, '') AS branch_name,
            COALESCE(t.create_datetime, t.create_date_time_now)::text AS created_at
       FROM ic_trans t
       LEFT JOIN ap_supplier s ON s.code = t.cust_code
       LEFT JOIN erp_branch_list b ON b.code = t.branch_code
      WHERE t.doc_no = $1 AND t.trans_flag = 6
      LIMIT 1`,
    [docNo],
  );
  if (!hrows[0]) return null;

  const [{ rows: lines }, { rows: receipts }, { rows: payableRows }, { rows: appr }, { rows: atts }] = await Promise.all([
    pool.query<PoLine>(
      `SELECT d.line_number,
              COALESCE(d.item_code,'') AS item_code,
              COALESCE(d.item_name,'') AS item_name,
              COALESCE(d.unit_code,'') AS unit,
              COALESCE(d.qty,0)::text AS qty,
              COALESCE(d.price,0)::text AS price,
              COALESCE(d.sum_amount,0)::text AS sum_amount,
              COALESCE(d.wh_code,'') AS wh_code,
              COALESCE(w.name_1,'') AS wh_name,
              COALESCE(g.recv,0)::text AS received,
              g.pui,
              COALESCE(lb.price,0)::text AS last_buy_price,
              lb.doc_date::text AS last_buy_date,
              COALESCE(d.ref_doc_no,'') AS ref_pr
         FROM ic_trans_detail d
         LEFT JOIN ic_warehouse w ON w.code = d.wh_code
         LEFT JOIN LATERAL (
           SELECT SUM(gr.qty) AS recv, string_agg(DISTINCT gr.doc_no, ', ') AS pui
             FROM ic_trans_detail gr
            WHERE gr.trans_flag = 12 AND gr.ref_doc_no = d.doc_no
              AND gr.ref_line_number = d.line_number AND gr.last_status = 0
         ) g ON true
         LEFT JOIN LATERAL (
           SELECT lg.price, lg.doc_date
             FROM ic_trans_detail lg
            WHERE lg.trans_flag = 12 AND lg.item_code = d.item_code
              AND lg.last_status = 0 AND lg.price > 0
              AND COALESCE(lg.ref_doc_no,'') <> d.doc_no
            ORDER BY lg.doc_date DESC NULLS LAST, lg.doc_no DESC
            LIMIT 1
         ) lb ON true
        WHERE d.doc_no = $1 AND d.trans_flag = 6
        ORDER BY d.line_number`,
      [docNo],
    ),
    pool.query<PoReceipt>(
      `SELECT g.doc_no AS pui,
              g.doc_date::text AS doc_date,
              COALESCE(g.create_datetime, g.create_date_time_now)::text AS created_at,
              g.ref_line_number AS ref_line,
              COALESCE(g.item_code,'') AS item_code,
              COALESCE(g.item_name,'') AS item_name,
              COALESCE(g.qty,0)::text AS qty,
              COALESCE(g.unit_code,'') AS unit,
              COALESCE(g.wh_code,'') AS wh_code,
              COALESCE(w.name_1,'') AS wh_name
         FROM ic_trans_detail g
         LEFT JOIN ic_warehouse w ON w.code = g.wh_code
        WHERE g.trans_flag = 12 AND g.ref_doc_no = $1 AND g.last_status = 0
        ORDER BY g.doc_date, g.doc_no, g.ref_line_number`,
      [docNo],
    ),
    pool.query<PoPayable>(
      `SELECT (count(*) > 0) AS has_ap,
              COALESCE(SUM(amount),0)::text AS amount,
              COALESCE(SUM(balance_amount),0)::text AS balance,
              COALESCE(MAX(overdue_day),0)::int AS overdue_day,
              string_agg(DISTINCT doc_no, ', ') AS docs
         FROM odg_ap_balance WHERE ref_doc_no = $1`,
      [docNo],
    ),
    pool.query<PoApproval>(
      `SELECT status, wpoa_no, poa_no, submitted_by, submitted_at, approved_by, approved_at, reject_reason
         FROM odg_pm_po_approval WHERE doc_no = $1`,
      [docNo],
    ),
    pool.query<PoAttachment>(
      `SELECT id, doc_no, kind, file_name, file_path, content_type, size_bytes::text, uploaded_by, uploaded_at
         FROM odg_pm_po_attachment WHERE doc_no = $1 ORDER BY uploaded_at`,
      [docNo],
    ),
  ]);

  const approval: PoApproval =
    appr[0] ?? {
      status: hrows[0].approve_status === 1 ? "approved" : "draft",
      wpoa_no: null,
      poa_no: null,
      submitted_by: null,
      submitted_at: null,
      approved_by: null,
      approved_at: null,
      reject_reason: null,
    };

  const payable: PoPayable = payableRows[0] ?? { has_ap: false, amount: "0", balance: "0", overdue_day: 0, docs: null };

  return { header: hrows[0], lines, receipts, payable, approval, attachments: atts };
}

export async function addAttachmentRecord(
  docNo: string,
  meta: { kind: string; file_name: string; file_path: string; content_type: string; size_bytes: number },
  user: { employeeCode: string },
): Promise<void> {
  await pool.query(
    `INSERT INTO odg_pm_po_attachment (doc_no, kind, file_name, file_path, content_type, size_bytes, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [docNo, meta.kind, meta.file_name, meta.file_path, meta.content_type, meta.size_bytes, user.employeeCode],
  );
}

export async function getAttachment(id: number): Promise<PoAttachment | null> {
  const { rows } = await pool.query<PoAttachment>(
    `SELECT id, doc_no, kind, file_name, file_path, content_type, size_bytes::text, uploaded_by, uploaded_at
       FROM odg_pm_po_attachment WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function deleteAttachment(id: number): Promise<string | null> {
  const { rows } = await pool.query<{ file_path: string }>(
    `DELETE FROM odg_pm_po_attachment WHERE id = $1 RETURNING file_path`,
    [id],
  );
  return rows[0]?.file_path ?? null;
}

function two2(n: number) {
  return String(n).padStart(2, "0");
}

// WPOA approval doc: ic_trans trans_flag 8, doc_no = WPOA<YYYY><MM><NNNN>, doc_ref = PO.
async function nextWpoaNo(client: PoolClient): Promise<string> {
  const now = new Date();
  const prefix = `WPOA${now.getFullYear()}${two2(now.getMonth() + 1)}`; // 10 chars
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [prefix]);
  const { rows } = await client.query<{ next: number }>(
    `SELECT COALESCE(MAX(RIGHT(doc_no,4)::int),0)+1 AS next
       FROM ic_trans WHERE trans_flag = 8 AND doc_no LIKE $1 AND LENGTH(doc_no) = 14`,
    [`${prefix}%`],
  );
  return `${prefix}${String(rows[0]?.next ?? 1).padStart(4, "0")}`;
}

// POA approval doc created at approval time: POH→POHA (POHA<YY><MM><NNNN>, len 12),
// POT→POTA (POTA<YY><NNNN>, len 10). ic_trans trans_flag 8, doc_ref = PO.
async function nextApprovalNo(client: PoolClient, format: string): Promise<{ fmt: string; docNo: string }> {
  const now = new Date();
  const yy = two2(now.getFullYear() % 100);
  const mm = two2(now.getMonth() + 1);
  const isHead = format === "POH";
  const fmt = isHead ? "POHA" : "POTA";
  const prefix = isHead ? `${fmt}${yy}${mm}` : `${fmt}${yy}`;
  const len = isHead ? 12 : 10;
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [prefix]);
  const { rows } = await client.query<{ next: number }>(
    `SELECT COALESCE(MAX(RIGHT(doc_no,4)::int),0)+1 AS next
       FROM ic_trans WHERE trans_flag = 8 AND doc_no LIKE $1 AND LENGTH(doc_no) = $2`,
    [`${prefix}%`, len],
  );
  return { fmt, docNo: `${prefix}${String(rows[0]?.next ?? 1).padStart(4, "0")}` };
}

type ActionResult = { ok: true; wpoa_no?: string; poa_no?: string } | { ok: false; error: string };

// Submit PO for approval: create the WPOA document (approve_status 0) and mark pending.
export async function submitForApproval(
  docNo: string,
  user: { employeeCode: string },
): Promise<ActionResult> {
  const detail = await getPurchaseOrder(docNo);
  if (!detail) return { ok: false, error: "ບໍ່ພົບ PO" };
  if (detail.approval.status === "approved") return { ok: false, error: "PO ນີ້ອະນຸມັດແລ້ວ" };
  if (detail.attachments.length === 0) return { ok: false, error: "ຕ້ອງແນບແຜນ/ເອກະສານຢ່າງໜ້ອຍ 1 ໄຟລ໌ ກ່ອນຂໍອະນຸມັດ" };

  const h = detail.header;
  const now = new Date();
  const docTime = `${two2(now.getHours())}:${two2(now.getMinutes())}`;

  const client = await pool.connect();
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await client.query("BEGIN");
        const wpoa = await nextWpoaNo(client);
        await client.query(
          `INSERT INTO ic_trans
             (trans_type, trans_flag, doc_format_code, doc_no, doc_date, doc_time,
              cust_code, branch_code, doc_ref, total_value, total_amount, remark,
              creator_code, user_request, create_datetime, create_date_time_now,
              approve_status, status, last_status)
           VALUES
             (1, 8, 'WPOA', $1, CURRENT_DATE, $2,
              $3, $4, $5, $6, $7, $8,
              $9, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
              0, 0, 0)`,
          [wpoa, docTime, h.supplier_code, h.branch_code, docNo, h.total_value, h.total_amount, `ຂໍອະນຸມັດ ${docNo}`, user.employeeCode],
        );
        await client.query(
          `INSERT INTO odg_pm_po_approval (doc_no, status, wpoa_no, submitted_by, submitted_at, created_by)
           VALUES ($1, 'pending', $2, $3, now(), $3)
           ON CONFLICT (doc_no) DO UPDATE
             SET status='pending', wpoa_no=$2, submitted_by=$3, submitted_at=now(),
                 reject_reason=NULL, updated_at=now()`,
          [docNo, wpoa, user.employeeCode],
        );
        await client.query("COMMIT");
        return { ok: true, wpoa_no: wpoa };
      } catch (err) {
        await client.query("ROLLBACK");
        if ((err as { code?: string }).code === "23505" && attempt < 4) continue;
        throw err;
      }
    }
    return { ok: false, error: "ບໍ່ສາມາດອອກເລກ WPOA ໄດ້, ລອງໃໝ່" };
  } finally {
    client.release();
  }
}

// Director approves: create the POA doc (POHA/POTA, flag 8), set PO + WPOA + POA
// approve_status = 1, and mark the workflow approved.
export async function approvePurchaseOrder(
  docNo: string,
  user: { employeeCode: string },
): Promise<ActionResult> {
  const detail = await getPurchaseOrder(docNo);
  if (!detail) return { ok: false, error: "ບໍ່ພົບ PO" };
  const h = detail.header;
  const now = new Date();
  const docTime = `${two2(now.getHours())}:${two2(now.getMinutes())}`;

  const client = await pool.connect();
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await client.query("BEGIN");
        const { fmt, docNo: poaNo } = await nextApprovalNo(client, h.format);

        // Create the POA approval document referencing the PO.
        await client.query(
          `INSERT INTO ic_trans
             (trans_type, trans_flag, doc_format_code, doc_no, doc_date, doc_time,
              cust_code, branch_code, doc_ref, total_value, total_amount, remark,
              creator_code, user_request, user_approve, approve_date,
              create_datetime, create_date_time_now,
              approve_status, status, last_status)
           VALUES
             (1, 8, $1, $2, CURRENT_DATE, $3,
              $4, $5, $6, $7, $8, $9,
              $10, $10, $10, CURRENT_DATE,
              CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
              1, 0, 0)`,
          [fmt, poaNo, docTime, h.supplier_code, h.branch_code, docNo, h.total_value, h.total_amount, `ອະນຸມັດ ${docNo}`, user.employeeCode],
        );

        // Approve the PO itself.
        await client.query(
          `UPDATE ic_trans SET approve_status=1, user_approve=$2, approve_date=CURRENT_DATE
            WHERE doc_no=$1 AND trans_flag=6`,
          [docNo, user.employeeCode],
        );

        // Approve the WPOA request (if it exists) and record the POA number.
        const upd = await client.query(
          `UPDATE odg_pm_po_approval
              SET status='approved', poa_no=$2, approved_by=$3, approved_at=now(),
                  reject_reason=NULL, updated_at=now()
            WHERE doc_no=$1 RETURNING wpoa_no`,
          [docNo, poaNo, user.employeeCode],
        );
        if (upd.rowCount === 0) {
          await client.query(
            `INSERT INTO odg_pm_po_approval (doc_no, status, poa_no, approved_by, approved_at, created_by)
             VALUES ($1, 'approved', $2, $3, now(), $3)`,
            [docNo, poaNo, user.employeeCode],
          );
        }
        const wpoa = upd.rows[0]?.wpoa_no as string | undefined;
        if (wpoa) {
          await client.query(
            `UPDATE ic_trans SET approve_status=1, user_approve=$2, approve_date=CURRENT_DATE
              WHERE doc_no=$1 AND trans_flag=8`,
            [wpoa, user.employeeCode],
          );
        }

        await client.query("COMMIT");
        return { ok: true, wpoa_no: wpoa, poa_no: poaNo };
      } catch (err) {
        await client.query("ROLLBACK");
        if ((err as { code?: string }).code === "23505" && attempt < 4) continue;
        return { ok: false, error: (err as Error).message };
      }
    }
    return { ok: false, error: "ບໍ່ສາມາດອອກເລກ POA ໄດ້, ລອງໃໝ່" };
  } finally {
    client.release();
  }
}

export async function rejectPurchaseOrder(
  docNo: string,
  reason: string,
  user: { employeeCode: string },
): Promise<ActionResult> {
  await pool.query(
    `INSERT INTO odg_pm_po_approval (doc_no, status, reject_reason, approved_by, approved_at, created_by)
     VALUES ($1, 'rejected', $2, $3, now(), $3)
     ON CONFLICT (doc_no) DO UPDATE
       SET status='rejected', reject_reason=$2, approved_by=$3, approved_at=now(), updated_at=now()`,
    [docNo, reason || "ບໍ່ລະບຸເຫດຜົນ", user.employeeCode],
  );
  return { ok: true };
}

// Revoke approval: delete the POA doc, revert PO (and WPOA) approve_status to 0,
// and move the workflow back to pending (request still stands) or draft.
export async function revokeApproval(docNo: string): Promise<ActionResult> {
  const { rows } = await pool.query<{ poa_no: string | null; wpoa_no: string | null }>(
    `SELECT poa_no, wpoa_no FROM odg_pm_po_approval WHERE doc_no = $1`,
    [docNo],
  );
  const poaNo = rows[0]?.poa_no ?? null;
  const wpoaNo = rows[0]?.wpoa_no ?? null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Remove the POA approval document we created.
    if (poaNo) {
      await client.query(`DELETE FROM ic_trans WHERE doc_no = $1 AND trans_flag = 8`, [poaNo]);
    }
    // Revert the PO approve_status.
    await client.query(
      `UPDATE ic_trans SET approve_status=0, user_approve=NULL, approve_date=NULL
        WHERE doc_no=$1 AND trans_flag=6`,
      [docNo],
    );
    // Revert the WPOA request back to not-approved (kept, so status returns to pending).
    if (wpoaNo) {
      await client.query(
        `UPDATE ic_trans SET approve_status=0, user_approve=NULL, approve_date=NULL
          WHERE doc_no=$1 AND trans_flag=8`,
        [wpoaNo],
      );
    }
    await client.query(
      `UPDATE odg_pm_po_approval
          SET status = CASE WHEN wpoa_no IS NOT NULL THEN 'pending' ELSE 'draft' END,
              poa_no=NULL, approved_by=NULL, approved_at=NULL, updated_at=now()
        WHERE doc_no=$1`,
      [docNo],
    );
    await client.query("COMMIT");
    return { ok: true, poa_no: poaNo ?? undefined };
  } catch (err) {
    await client.query("ROLLBACK");
    return { ok: false, error: (err as Error).message };
  } finally {
    client.release();
  }
}

// ===== Director approval inbox — POs awaiting approval =====
export type PendingApproval = {
  doc_no: string;
  format: string;
  doc_date: string | null;
  supplier_code: string;
  supplier_name: string;
  currency_code: string;
  total_amount: string;
  wpoa_no: string | null;
  submitted_by: string;
  submitted_at: string | null;
  attachments: number;
};

export async function listPendingApprovals(limit = 200): Promise<PendingApproval[]> {
  const { rows } = await pool.query<PendingApproval>(
    `SELECT t.doc_no,
            t.doc_format_code AS format,
            t.doc_date,
            COALESCE(t.cust_code,'') AS supplier_code,
            COALESCE(s.name_1, t.cust_code, '') AS supplier_name,
            COALESCE(t.currency_code,'') AS currency_code,
            COALESCE(t.total_amount,0)::text AS total_amount,
            a.wpoa_no,
            COALESCE(a.submitted_by,'') AS submitted_by,
            a.submitted_at,
            (SELECT count(*)::int FROM odg_pm_po_attachment x WHERE x.doc_no = t.doc_no) AS attachments
       FROM odg_pm_po_approval a
       JOIN ic_trans t ON t.doc_no = a.doc_no AND t.trans_flag = 6
       LEFT JOIN ap_supplier s ON s.code = t.cust_code
      WHERE a.status = 'pending'
      ORDER BY a.submitted_at ASC NULLS LAST
      LIMIT ${limit}`,
  );
  return rows;
}

export async function countPendingApprovals(): Promise<number> {
  const { rows } = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM odg_pm_po_approval WHERE status = 'pending'`,
  );
  return rows[0]?.n ?? 0;
}

export type PendingLine = {
  doc_no: string;
  line_number: number;
  item_code: string;
  item_name: string;
  unit: string;
  qty: string;
  price: string;
  last_buy_price: string;
  last_buy_date: string | null;
};

// Order lines (with last purchase price) for a set of pending POs — for the inbox.
export async function getPendingLines(docNos: string[]): Promise<PendingLine[]> {
  if (docNos.length === 0) return [];
  const { rows } = await pool.query<PendingLine>(
    `SELECT d.doc_no,
            d.line_number,
            COALESCE(d.item_code,'') AS item_code,
            COALESCE(d.item_name,'') AS item_name,
            COALESCE(d.unit_code,'') AS unit,
            COALESCE(d.qty,0)::text AS qty,
            COALESCE(d.price,0)::text AS price,
            COALESCE(lb.price,0)::text AS last_buy_price,
            lb.doc_date::text AS last_buy_date
       FROM ic_trans_detail d
       LEFT JOIN LATERAL (
         SELECT lg.price, lg.doc_date
           FROM ic_trans_detail lg
          WHERE lg.trans_flag = 12 AND lg.item_code = d.item_code
            AND lg.last_status = 0 AND lg.price > 0
            AND COALESCE(lg.ref_doc_no,'') <> d.doc_no
          ORDER BY lg.doc_date DESC NULLS LAST, lg.doc_no DESC
          LIMIT 1
       ) lb ON true
      WHERE d.doc_no = ANY($1) AND d.trans_flag = 6
      ORDER BY d.doc_no, d.line_number`,
    [docNos],
  );
  return rows;
}

export async function getAttachmentsFor(docNos: string[]): Promise<PoAttachment[]> {
  if (docNos.length === 0) return [];
  const { rows } = await pool.query<PoAttachment>(
    `SELECT id, doc_no, kind, file_name, file_path, content_type, size_bytes::text, uploaded_by, uploaded_at
       FROM odg_pm_po_attachment WHERE doc_no = ANY($1) ORDER BY doc_no, uploaded_at`,
    [docNos],
  );
  return rows;
}

// ===== Odoo-style chatter: messages, activities, followers =====

export type PoComment = {
  id: number;
  kind: string;
  body: string;
  author: string;
  author_code: string;
  created_at: string | null;
};

export async function getPoComments(docNo: string, limit = 100): Promise<PoComment[]> {
  const { rows } = await pool.query<PoComment>(
    `SELECT c.id, c.kind, c.body,
            COALESCE(e.fullname_lo, c.created_by, '') AS author,
            COALESCE(c.created_by,'') AS author_code,
            c.created_at::text AS created_at
       FROM odg_pm_po_comment c
       LEFT JOIN odg_employee e ON e.employee_code = c.created_by
      WHERE c.doc_no = $1
      ORDER BY c.created_at DESC
      LIMIT ${limit}`,
    [docNo],
  );
  return rows;
}

export type PoActivity = {
  id: number;
  title: string;
  assignee_name: string;
  assignee_code: string;
  due_date: string | null;
  status: string;
  created_by_name: string;
};

export async function getPoActivities(docNo: string): Promise<PoActivity[]> {
  const { rows } = await pool.query<PoActivity>(
    `SELECT a.id, a.title,
            COALESCE(asg.fullname_lo, a.assignee, '') AS assignee_name,
            COALESCE(a.assignee,'') AS assignee_code,
            a.due_date::text AS due_date, a.status,
            COALESCE(cb.fullname_lo, a.created_by, '') AS created_by_name
       FROM odg_pm_po_activity a
       LEFT JOIN odg_employee asg ON asg.employee_code = a.assignee
       LEFT JOIN odg_employee cb ON cb.employee_code = a.created_by
      WHERE a.doc_no = $1
      ORDER BY (a.status = 'done'), a.due_date ASC NULLS LAST, a.created_at DESC`,
    [docNo],
  );
  return rows;
}

export type PoFollower = { employee_code: string; name: string };

export async function getPoFollowers(docNo: string): Promise<PoFollower[]> {
  const { rows } = await pool.query<PoFollower>(
    `SELECT f.employee_code, COALESCE(e.fullname_lo, f.employee_code) AS name
       FROM odg_pm_po_follower f
       LEFT JOIN odg_employee e ON e.employee_code = f.employee_code
      WHERE f.doc_no = $1
      ORDER BY f.created_at`,
    [docNo],
  );
  return rows;
}

// Append a system log line to the chatter (used on submit/approve/reject).
export async function logPoEvent(docNo: string, body: string, byCode: string): Promise<void> {
  await pool.query(
    `INSERT INTO odg_pm_po_comment (doc_no, kind, body, created_by) VALUES ($1, 'log', $2, $3)`,
    [docNo, body.slice(0, 500), byCode],
  );
}
