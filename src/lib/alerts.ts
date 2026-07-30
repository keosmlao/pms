import { pool } from "@/lib/db";

// E-1 notifications/tasks — derived from existing data (no new table). Cheap COUNTs
// that surface what needs attention: pending approvals, stock out of band, overdue
// payables & receipts.

export type Alerts = {
  pendingPo: number;
  pendingPr: number;
  belowMin: number;
  aboveMax: number;
  overduePayables: number;
  overduePayablesAmount: string;
  overdueReceipts: number;
};

export async function getAlerts(opts: { isAdmin: boolean; mineOf?: string }): Promise<Alerts> {
  const mineOf = opts.mineOf?.trim() ?? "";
  // owner-scoped EXISTS for the min/max stock counts (own query, own params)
  const ownerClause = (alias: string, idx: number) =>
    mineOf
      ? `AND EXISTS (SELECT 1 FROM odg_group_responsible gr WHERE gr.employee_code = $${idx}
           AND gr.group_main = ${alias}.group_main AND (gr.group_sub = '' OR gr.group_sub = ${alias}.group_sub))`
      : "";
  const mp = mineOf ? [mineOf] : [];

  const [pendingPo, pendingPr, belowMin, aboveMax, payables, receipts] = await Promise.all([
    opts.isAdmin
      ? pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM odg_pm_po_approval WHERE status = 'pending'`)
      : Promise.resolve({ rows: [{ n: 0 }] }),
    // odg_pm_pr may not exist yet (migration 014 applied manually) → treat as 0.
    pool
      .query<{ n: number }>(`SELECT count(*)::int AS n FROM odg_pm_pr WHERE status = 'pending'`)
      .catch(() => ({ rows: [{ n: 0 }] })),
    pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM odg_min_stock_setting m JOIN ic_inventory i ON i.code = m.item_code
        WHERE m.min_qty IS NOT NULL AND COALESCE(i.balance_qty,0) < m.min_qty ${ownerClause("i", 1)}`,
      mp,
    ),
    pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM odg_min_stock_setting m JOIN ic_inventory i ON i.code = m.item_code
        WHERE m.max_qty IS NOT NULL AND COALESCE(i.balance_qty,0) > m.max_qty ${ownerClause("i", 1)}`,
      mp,
    ),
    pool.query<{ n: number; amount: string }>(
      `SELECT count(*)::int AS n, COALESCE(SUM(balance_amount),0)::text AS amount
         FROM odg_ap_balance WHERE COALESCE(balance_amount,0) > 0 AND COALESCE(overdue_day,0) > 0`,
    ),
    pool.query<{ n: number }>(
      `SELECT count(DISTINCT doc_no)::int AS n FROM odg_po_remain
        WHERE COALESCE(qty_balance,0) > 0 AND (CURRENT_DATE - doc_date) > 30`,
    ),
  ]);

  return {
    pendingPo: pendingPo.rows[0]?.n ?? 0,
    pendingPr: pendingPr.rows[0]?.n ?? 0,
    belowMin: belowMin.rows[0]?.n ?? 0,
    aboveMax: aboveMax.rows[0]?.n ?? 0,
    overduePayables: payables.rows[0]?.n ?? 0,
    overduePayablesAmount: payables.rows[0]?.amount ?? "0",
    overdueReceipts: receipts.rows[0]?.n ?? 0,
  };
}

export function alertTotal(a: Alerts): number {
  return a.pendingPo + a.pendingPr + a.belowMin + a.aboveMax + a.overduePayables + a.overdueReceipts;
}
