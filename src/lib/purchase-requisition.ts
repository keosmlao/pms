import type { PoolClient } from "pg";
import { pool } from "@/lib/db";

// Internal Purchase Requisition (ໃບຂໍຊື້) — odg_pm_pr + odg_pm_pr_line (migration 014).
// Flow: draft → pending → approved → converted (to PO) | rejected.

export type PrStatus = "draft" | "pending" | "approved" | "rejected" | "converted";

export const PR_STATUS: Record<PrStatus, { label: string; cls: string }> = {
  draft: { label: "ຮ່າງ", cls: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" },
  pending: { label: "ລໍຖ້າອະນຸມັດ", cls: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" },
  approved: { label: "ອະນຸມັດແລ້ວ", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" },
  rejected: { label: "ຖືກປະຕິເສດ", cls: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400" },
  converted: { label: "ສ້າງ PO ແລ້ວ", cls: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400" },
};

export type PrLineInput = { item_code: string; item_name: string; unit: string; qty: number; est_price: number; note: string };
export type CreatePrInput = { department_code: string; need_date: string; note: string; submit: boolean; lines: PrLineInput[] };

export type PrListRow = {
  id: number;
  pr_no: string;
  doc_date: string | null;
  department_name: string;
  requester_name: string;
  status: PrStatus;
  lines: number;
  est_total: string;
  po_no: string | null;
};

export type PrLineRow = { line_no: number; item_code: string; item_name: string; unit: string; qty: string; est_price: string; note: string };
export type PrDetail = {
  id: number;
  pr_no: string;
  doc_date: string | null;
  department_code: string;
  department_name: string;
  requester_code: string;
  requester_name: string;
  need_date: string | null;
  note: string;
  status: PrStatus;
  reject_reason: string;
  approved_by_name: string;
  approved_at: string | null;
  po_no: string | null;
  lines: PrLineRow[];
};

const two = (n: number) => String(n).padStart(2, "0");

async function nextPrNo(client: PoolClient): Promise<string> {
  const now = new Date();
  const prefix = `PR${two(now.getFullYear() % 100)}${two(now.getMonth() + 1)}`; // e.g. PR2607
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [prefix]);
  const { rows } = await client.query<{ next: number }>(
    `SELECT COALESCE(MAX(RIGHT(pr_no, 4)::int), 0) + 1 AS next
       FROM odg_pm_pr WHERE pr_no LIKE $1 AND LENGTH(pr_no) = 10`,
    [`${prefix}%`],
  );
  return `${prefix}${String(rows[0]?.next ?? 1).padStart(4, "0")}`;
}

export async function createPr(
  input: CreatePrInput,
  ctx: { employeeCode: string },
): Promise<{ ok: true; id: number; pr_no: string } | { ok: false; error: string }> {
  const lines = input.lines.filter((l) => l.item_name.trim() && l.qty > 0);
  if (lines.length === 0) return { ok: false, error: "ຕ້ອງມີຢ່າງໜ້ອຍ 1 ລາຍການ" };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const pr_no = await nextPrNo(client);
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO odg_pm_pr (pr_no, department_code, requester_code, need_date, note, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $3) RETURNING id`,
      [pr_no, input.department_code || null, ctx.employeeCode, input.need_date || null, input.note || null, input.submit ? "pending" : "draft"],
    );
    const id = rows[0].id;
    let n = 1;
    for (const l of lines) {
      await client.query(
        `INSERT INTO odg_pm_pr_line (pr_id, line_no, item_code, item_name, unit, qty, est_price, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, n++, l.item_code || null, l.item_name.slice(0, 200), l.unit || null, l.qty, l.est_price || 0, l.note?.slice(0, 200) || null],
      );
    }
    await client.query("COMMIT");
    return { ok: true, id, pr_no };
  } catch (e) {
    await client.query("ROLLBACK");
    return { ok: false, error: (e as Error).message };
  } finally {
    client.release();
  }
}

export async function listPurchaseRequisitions(opts: {
  q?: string;
  status?: string;
  mine?: string;
  limit?: number;
  offset?: number;
}): Promise<PrListRow[]> {
  const q = (opts.q ?? "").trim();
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = Math.max(0, opts.offset ?? 0);
  const params: unknown[] = [];
  const where: string[] = ["TRUE"];
  if (q) {
    params.push(`%${q}%`);
    where.push(`(p.pr_no ILIKE $${params.length} OR p.note ILIKE $${params.length})`);
  }
  if (opts.status && opts.status !== "all") {
    params.push(opts.status);
    where.push(`p.status = $${params.length}`);
  }
  if (opts.mine) {
    params.push(opts.mine);
    where.push(`p.requester_code = $${params.length}`);
  }
  const { rows } = await pool.query<PrListRow>(
    `SELECT p.id, p.pr_no, p.doc_date::text AS doc_date,
            COALESCE(d.department_name_lo, p.department_code, '') AS department_name,
            COALESCE(e.fullname_lo, p.requester_code, '') AS requester_name,
            p.status, p.po_no,
            (SELECT count(*)::int FROM odg_pm_pr_line l WHERE l.pr_id = p.id) AS lines,
            (SELECT COALESCE(SUM(l.qty * l.est_price), 0) FROM odg_pm_pr_line l WHERE l.pr_id = p.id)::text AS est_total
       FROM odg_pm_pr p
       LEFT JOIN odg_department d ON d.department_code = p.department_code
       LEFT JOIN odg_employee e ON e.employee_code = p.requester_code
      WHERE ${where.join(" AND ")}
      ORDER BY p.doc_date DESC NULLS LAST, p.id DESC
      LIMIT ${limit} OFFSET ${offset}`,
    params,
  );
  return rows;
}

export async function getPr(id: number): Promise<PrDetail | null> {
  const { rows } = await pool.query<Omit<PrDetail, "lines">>(
    `SELECT p.id, p.pr_no, p.doc_date::text AS doc_date,
            COALESCE(p.department_code, '') AS department_code,
            COALESCE(d.department_name_lo, p.department_code, '') AS department_name,
            p.requester_code, COALESCE(e.fullname_lo, p.requester_code, '') AS requester_name,
            p.need_date::text AS need_date, COALESCE(p.note, '') AS note, p.status,
            COALESCE(p.reject_reason, '') AS reject_reason,
            COALESCE(ae.fullname_lo, p.approved_by, '') AS approved_by_name,
            p.approved_at::text AS approved_at, p.po_no
       FROM odg_pm_pr p
       LEFT JOIN odg_department d ON d.department_code = p.department_code
       LEFT JOIN odg_employee e ON e.employee_code = p.requester_code
       LEFT JOIN odg_employee ae ON ae.employee_code = p.approved_by
      WHERE p.id = $1`,
    [id],
  );
  if (!rows[0]) return null;
  const { rows: lines } = await pool.query<PrLineRow>(
    `SELECT line_no, COALESCE(item_code, '') AS item_code, item_name, COALESCE(unit, '') AS unit,
            qty::text AS qty, COALESCE(est_price, 0)::text AS est_price, COALESCE(note, '') AS note
       FROM odg_pm_pr_line WHERE pr_id = $1 ORDER BY line_no`,
    [id],
  );
  return { ...rows[0], lines };
}

async function setStatus(id: number, from: PrStatus[], set: Record<string, unknown>): Promise<boolean> {
  const keys = Object.keys(set);
  const assigns = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
  const inList = from.map((_, i) => `$${keys.length + 2 + i}`).join(", ");
  const { rowCount } = await pool.query(
    `UPDATE odg_pm_pr SET ${assigns}, updated_at = now() WHERE id = $1 AND status IN (${inList})`,
    [id, ...keys.map((k) => set[k]), ...from],
  );
  return (rowCount ?? 0) > 0;
}

export async function submitPr(id: number): Promise<boolean> {
  return setStatus(id, ["draft"], { status: "pending" });
}
export async function approvePr(id: number, ctx: { employeeCode: string }): Promise<boolean> {
  return setStatus(id, ["pending"], { status: "approved", approved_by: ctx.employeeCode, approved_at: new Date() });
}
export async function rejectPr(id: number, reason: string): Promise<boolean> {
  return setStatus(id, ["pending"], { status: "rejected", reject_reason: reason || null });
}
export async function markPrConverted(id: number, poNo: string): Promise<boolean> {
  return setStatus(id, ["approved"], { status: "converted", po_no: poNo });
}

// Approved PR lines → seed a new PO (vendor + price chosen there).
export async function getPrForConvert(id: number): Promise<{ pr_no: string; lines: PrLineInput[] } | null> {
  const { rows } = await pool.query<{ pr_no: string; status: string }>(
    `SELECT pr_no, status FROM odg_pm_pr WHERE id = $1`,
    [id],
  );
  if (!rows[0] || rows[0].status !== "approved") return null;
  const { rows: lines } = await pool.query<PrLineInput>(
    `SELECT COALESCE(item_code, '') AS item_code, item_name, COALESCE(unit, '') AS unit,
            qty::float8 AS qty, COALESCE(est_price, 0)::float8 AS est_price, COALESCE(note, '') AS note
       FROM odg_pm_pr_line WHERE pr_id = $1 ORDER BY line_no`,
    [id],
  );
  return { pr_no: rows[0].pr_no, lines };
}
