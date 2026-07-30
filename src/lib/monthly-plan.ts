import { pool } from "@/lib/db";

export type MonthlyPlan = {
  id: number;
  title: string;
  plan_year: number;
  note: string;
  created_by: string;
  created_at: string;
  item_count: number;
};

export type MonthlyPlanItem = {
  id: number;
  item_code: string;
  name: string;
  brand: string;
  plan: Record<number, number>; // month(1-12) → planned qty
  lastYear: Record<number, number>; // month → actual sales last year
  thisYear: Record<number, number>; // month → actual sales this year
};

export async function listMonthlyPlans(): Promise<MonthlyPlan[]> {
  const { rows } = await pool.query<MonthlyPlan>(
    `SELECT p.id, p.title, p.plan_year, COALESCE(p.note,'') AS note, p.created_by, p.created_at::text,
            (SELECT count(*)::int FROM odg_pm_monthly_plan_item i WHERE i.plan_id = p.id) AS item_count
       FROM odg_pm_monthly_plan p
      ORDER BY p.plan_year DESC, p.id DESC`,
  );
  return rows;
}

export async function getMonthlyPlan(
  id: number,
): Promise<{ plan: MonthlyPlan; items: MonthlyPlanItem[] } | null> {
  const planRes = await pool.query<MonthlyPlan>(
    `SELECT p.id, p.title, p.plan_year, COALESCE(p.note,'') AS note, p.created_by, p.created_at::text, 0 AS item_count
       FROM odg_pm_monthly_plan p WHERE p.id = $1`,
    [id],
  );
  const plan = planRes.rows[0];
  if (!plan) return null;

  const itemsRes = await pool.query<{ id: number; item_code: string; name: string; brand: string }>(
    `SELECT it.id, it.item_code,
            COALESCE(i.name_1,'') AS name,
            COALESCE(br.name_1, i.item_brand, '') AS brand
       FROM odg_pm_monthly_plan_item it
       LEFT JOIN ic_inventory i ON i.code = it.item_code
       LEFT JOIN ic_brand br ON br.code = i.item_brand
      WHERE it.plan_id = $1
      ORDER BY it.sort, it.id`,
    [id],
  );
  if (itemsRes.rows.length === 0) return { plan, items: [] };

  const codes = itemsRes.rows.map((r) => r.item_code);

  // Planned cells.
  const cellRes = await pool.query<{ item_id: number; month: number; qty: string }>(
    `SELECT c.item_id, c.month, c.qty::text
       FROM odg_pm_monthly_plan_cell c
       JOIN odg_pm_monthly_plan_item it ON it.id = c.item_id
      WHERE it.plan_id = $1`,
    [id],
  );

  // Actual monthly sales for last year and this year (trans_flag 44 = sale).
  const actRes = await pool.query<{ item_code: string; yr: number; mo: number; q: string }>(
    `SELECT d.item_code,
            EXTRACT(YEAR FROM d.doc_date)::int AS yr,
            EXTRACT(MONTH FROM d.doc_date)::int AS mo,
            SUM(d.qty)::text AS q
       FROM ic_trans_detail d
      WHERE d.trans_flag = 44 AND d.last_status = 0
        AND d.item_code = ANY($1)
        AND EXTRACT(YEAR FROM d.doc_date) IN ($2, $3)
      GROUP BY 1, 2, 3`,
    [codes, plan.plan_year, plan.plan_year - 1],
  );

  const planMap = new Map<number, Record<number, number>>();
  for (const c of cellRes.rows) {
    let m = planMap.get(c.item_id);
    if (!m) { m = {}; planMap.set(c.item_id, m); }
    m[c.month] = Number(c.qty);
  }
  const lastYearMap = new Map<string, Record<number, number>>();
  const thisYearMap = new Map<string, Record<number, number>>();
  for (const a of actRes.rows) {
    const target = a.yr === plan.plan_year ? thisYearMap : lastYearMap;
    let m = target.get(a.item_code);
    if (!m) { m = {}; target.set(a.item_code, m); }
    m[a.mo] = Number(a.q);
  }

  const items: MonthlyPlanItem[] = itemsRes.rows.map((r) => ({
    id: r.id,
    item_code: r.item_code,
    name: r.name,
    brand: r.brand,
    plan: planMap.get(r.id) ?? {},
    lastYear: lastYearMap.get(r.item_code) ?? {},
    thisYear: thisYearMap.get(r.item_code) ?? {},
  }));
  return { plan, items };
}
