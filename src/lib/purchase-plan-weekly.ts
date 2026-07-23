import { pool } from "@/lib/db";

export type WeeklyPlan = {
  id: number;
  title: string;
  plan_year: number;
  start_week: number;
  sale_weeks: number;
  arrival_weeks: number;
  status: string;
  note: string;
  created_by: string;
  created_at: string;
  item_count: number;
};

export type WeeklyPlanItem = {
  id: number;
  item_code: string | null;
  model: string;
  grp: string;
  stock_qty: string;
  sort: number;
  name: string;
  live_stock: string | null;
  avg_week_sale: string;
  // allowed months of stock from odg_stock_policy (sale + stock months), null if no policy
  policy_months: string | null;
  // key `${kind}:${week_no}` → qty
  cells: Record<string, number>;
  // actual ERP sales per week_no over the plan's sale window
  actual: Record<number, number>;
};

export async function listWeeklyPlans(): Promise<WeeklyPlan[]> {
  const { rows } = await pool.query<WeeklyPlan>(
    `SELECT p.id, p.title, p.plan_year, p.start_week, p.sale_weeks, p.arrival_weeks,
            p.status, COALESCE(p.note,'') AS note, p.created_by, p.created_at::text,
            (SELECT count(*)::int FROM odg_pm_weekly_plan_item i WHERE i.plan_id = p.id) AS item_count
       FROM odg_pm_weekly_plan p
      ORDER BY p.plan_year DESC, p.start_week DESC, p.id DESC`,
  );
  return rows;
}

export async function getWeeklyPlan(
  id: number,
): Promise<{ plan: WeeklyPlan; items: WeeklyPlanItem[] } | null> {
  const planRes = await pool.query<WeeklyPlan>(
    `SELECT p.id, p.title, p.plan_year, p.start_week, p.sale_weeks, p.arrival_weeks,
            p.status, COALESCE(p.note,'') AS note, p.created_by, p.created_at::text,
            0 AS item_count
       FROM odg_pm_weekly_plan p WHERE p.id = $1`,
    [id],
  );
  const plan = planRes.rows[0];
  if (!plan) return null;

  // Items with live ERP stock and average weekly sales over the last 6 weeks
  // (trans_flag 44 = sale, matching the products stock-movement rule).
  const itemsRes = await pool.query<Omit<WeeklyPlanItem, "cells">>(
    `SELECT it.id, it.item_code, it.model, it.grp, it.stock_qty::text, it.sort,
            COALESCE(i.name_1, '') AS name,
            i.balance_qty::text AS live_stock,
            COALESCE(s.avg_week, 0)::text AS avg_week_sale,
            (sp.sale_months + sp.stock_months)::text AS policy_months
       FROM odg_pm_weekly_plan_item it
       LEFT JOIN ic_inventory i ON i.code = it.item_code
       LEFT JOIN odg_stock_policy sp
              ON sp.group_main = i.group_main
             AND sp.brand = UPPER(COALESCE(i.item_brand,''))
             AND sp.supplier_name = ''
       LEFT JOIN LATERAL (
         SELECT ROUND(SUM(d.qty) / 6.0, 1) AS avg_week
           FROM ic_trans_detail d
          WHERE d.item_code = it.item_code
            AND d.trans_flag = 44 AND d.last_status = 0
            AND d.doc_date >= CURRENT_DATE - 42
       ) s ON it.item_code IS NOT NULL
      WHERE it.plan_id = $1
      ORDER BY it.grp, it.sort, it.id`,
    [id],
  );

  // Actual sales per ISO week over the plan's sale window (trans_flag 44 =
  // sale, last_status 0), keyed back to the plan's absolute week numbers.
  const wkStart = `${plan.plan_year}-${String(plan.start_week).padStart(2, "0")}`;
  const actualRes = await pool.query<{ item_code: string; iy: number; iw: number; qty: string }>(
    `SELECT d.item_code,
            to_char(d.doc_date, 'IYYY')::int AS iy,
            to_char(d.doc_date, 'IW')::int AS iw,
            SUM(d.qty)::text AS qty
       FROM ic_trans_detail d
      WHERE d.trans_flag = 44 AND d.last_status = 0
        AND d.item_code IN (SELECT item_code FROM odg_pm_weekly_plan_item
                             WHERE plan_id = $1 AND item_code IS NOT NULL)
        AND d.doc_date >= to_date($2, 'IYYY-IW')
        AND d.doc_date < to_date($2, 'IYYY-IW') + ($3::int * 7)
      GROUP BY 1, 2, 3`,
    [id, wkStart, plan.sale_weeks],
  );
  const actualMap = new Map<string, Record<number, number>>();
  for (const a of actualRes.rows) {
    const weekNo = a.iw + (a.iy > plan.plan_year ? 52 : 0);
    let m = actualMap.get(a.item_code);
    if (!m) {
      m = {};
      actualMap.set(a.item_code, m);
    }
    m[weekNo] = (m[weekNo] ?? 0) + Number(a.qty);
  }

  const cellsRes = await pool.query<{ item_id: number; kind: string; week_no: number; qty: string }>(
    `SELECT c.item_id, c.kind, c.week_no, c.qty::text
       FROM odg_pm_weekly_plan_cell c
       JOIN odg_pm_weekly_plan_item it ON it.id = c.item_id
      WHERE it.plan_id = $1`,
    [id],
  );

  const cellMap = new Map<number, Record<string, number>>();
  for (const c of cellsRes.rows) {
    let m = cellMap.get(c.item_id);
    if (!m) {
      m = {};
      cellMap.set(c.item_id, m);
    }
    m[`${c.kind}:${c.week_no}`] = Number(c.qty);
  }

  const items: WeeklyPlanItem[] = itemsRes.rows.map((r) => ({
    ...r,
    cells: cellMap.get(r.id) ?? {},
    actual: (r.item_code && actualMap.get(r.item_code)) || {},
  }));
  return { plan, items };
}
