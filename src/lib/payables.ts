import { pool } from "@/lib/db";

// A-4 Accounts payable (ໜີ້ຄ້າງຈ່າຍ) from odg_ap_balance. Open docs = balance_amount > 0.
// Aging by overdue_day: not-due (<=0), 1-30, 31-60, 61-90, 90+.

export type PayableSummary = {
  docs: number;
  suppliers: number;
  outstanding: string;
  overdue: string;
  not_due: string;
  b1_30: string;
  b31_60: string;
  b61_90: string;
  b90p: string;
};

export async function getPayableSummary(): Promise<PayableSummary> {
  const { rows } = await pool.query<PayableSummary>(
    `SELECT COUNT(*)::int AS docs,
            COUNT(DISTINCT ap_code)::int AS suppliers,
            COALESCE(SUM(balance_amount), 0)::text AS outstanding,
            COALESCE(SUM(balance_amount) FILTER (WHERE COALESCE(overdue_day,0) > 0), 0)::text AS overdue,
            COALESCE(SUM(balance_amount) FILTER (WHERE COALESCE(overdue_day,0) <= 0), 0)::text AS not_due,
            COALESCE(SUM(balance_amount) FILTER (WHERE overdue_day BETWEEN 1 AND 30), 0)::text AS b1_30,
            COALESCE(SUM(balance_amount) FILTER (WHERE overdue_day BETWEEN 31 AND 60), 0)::text AS b31_60,
            COALESCE(SUM(balance_amount) FILTER (WHERE overdue_day BETWEEN 61 AND 90), 0)::text AS b61_90,
            COALESCE(SUM(balance_amount) FILTER (WHERE overdue_day > 90), 0)::text AS b90p
       FROM odg_ap_balance
      WHERE COALESCE(balance_amount,0) > 0`,
  );
  return rows[0];
}

export type PayableRow = {
  ap_code: string;
  ap_name: string;
  doc_no: string;
  doc_date: string | null;
  due_date: string | null;
  amount: string;
  balance: string;
  overdue_day: number;
  doc_type_name: string;
};

const BUCKET_COND: Record<string, string> = {
  overdue: "COALESCE(overdue_day,0) > 0",
  notdue: "COALESCE(overdue_day,0) <= 0",
  b1_30: "overdue_day BETWEEN 1 AND 30",
  b31_60: "overdue_day BETWEEN 31 AND 60",
  b61_90: "overdue_day BETWEEN 61 AND 90",
  b90p: "overdue_day > 90",
};

export async function listPayables(opts: { q?: string; bucket?: string; groupBy?: string; limit?: number; offset?: number }): Promise<PayableRow[]> {
  const q = (opts.q ?? "").trim();
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = Math.max(0, opts.offset ?? 0);
  const params: unknown[] = [];
  const where: string[] = ["COALESCE(balance_amount,0) > 0"];
  if (q) {
    params.push(`%${q}%`);
    where.push(`(ap_code ILIKE $${params.length} OR ap_name ILIKE $${params.length} OR doc_no ILIKE $${params.length})`);
  }
  const bc = opts.bucket && BUCKET_COND[opts.bucket];
  if (bc) where.push(bc);

  const { rows } = await pool.query<PayableRow>(
    `SELECT COALESCE(ap_code,'') AS ap_code, COALESCE(ap_name,'') AS ap_name,
            COALESCE(doc_no,'') AS doc_no, doc_date::text AS doc_date, due_date::text AS due_date,
            COALESCE(amount,0)::text AS amount, COALESCE(balance_amount,0)::text AS balance,
            COALESCE(overdue_day,0)::int AS overdue_day, COALESCE(doc_type_name,'') AS doc_type_name
       FROM odg_ap_balance
      WHERE ${where.join(" AND ")}
      ORDER BY ${opts.groupBy === "supplier" ? "ap_name ASC, " : ""}COALESCE(overdue_day,0) DESC, balance_amount DESC
      LIMIT ${limit} OFFSET ${offset}`,
    params,
  );
  return rows;
}
