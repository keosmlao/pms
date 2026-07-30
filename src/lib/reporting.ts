import { pool } from "@/lib/db";

// D-2 Margin / GP report from odg_pm_price_history (sale-line level: revenue
// sum_amount, cost sum_of_cost, profit, qty; dimensions item/brand/category/
// group/customer + year_doc/month_doc). Aggregates by a chosen dimension.

export type MarginDim = "brand" | "category" | "group" | "item" | "customer" | "custgroup";

export const MARGIN_DIMS: { key: MarginDim; label: string }[] = [
  { key: "brand", label: "ຍີ່ຫໍ້" },
  { key: "category", label: "ໝວດ" },
  { key: "group", label: "ກຸ່ມຫຼັກ" },
  { key: "item", label: "ສິນຄ້າ" },
  { key: "customer", label: "ລູກຄ້າ" },
  { key: "custgroup", label: "ກຸ່ມລູກຄ້າ" },
];

// (groupExpr = row key/GROUP BY, nameExpr = display) per dimension.
const DIM_SQL: Record<MarginDim, { group: string; name: string }> = {
  brand: { group: "COALESCE(NULLIF(h.ic_brand,''),'—')", name: "COALESCE(NULLIF(h.ic_brand,''),'—')" },
  category: { group: "COALESCE(NULLIF(h.ic_category,''),'—')", name: "COALESCE(NULLIF(h.ic_category,''),'—')" },
  group: { group: "COALESCE(NULLIF(h.ic_group_main,''),'—')", name: "COALESCE(NULLIF(h.ic_group_main,''),'—')" },
  item: { group: "COALESCE(h.item_code,'')", name: "MAX(h.item_name)" },
  customer: { group: "COALESCE(h.cust_code,'')", name: "MAX(h.cust_name)" },
  custgroup: { group: "COALESCE(NULLIF(h.cust_group,''),'—')", name: "COALESCE(NULLIF(h.cust_group,''),'—')" },
};

export type PivotMeasure = "revenue" | "profit" | "qty";
export const PIVOT_MEASURES: { key: PivotMeasure; label: string }[] = [
  { key: "revenue", label: "ຍອດຂາຍ" },
  { key: "profit", label: "ກຳໄລ" },
  { key: "qty", label: "ຈຳນວນ" },
];
const MEASURE_COL: Record<PivotMeasure, string> = { revenue: "h.sum_amount", profit: "h.profit", qty: "h.qty" };

export type PivotRow = { code: string; name: string; cells: Record<number, number>; total: number };
export type Pivot = { months: number[]; rows: PivotRow[]; colTotals: Record<number, number>; grandTotal: number };

// Matrix: chosen dimension (rows) × month (columns) of a measure. Rows sorted by
// total desc, top-N kept.
export async function getPivot(opts: {
  rowDim: MarginDim;
  measure: PivotMeasure;
  fromYm: number;
  toYm: number;
  mineOf?: string;
  limit?: number;
}): Promise<Pivot> {
  const d = DIM_SQL[opts.rowDim] ?? DIM_SQL.brand;
  const measure = MEASURE_COL[opts.measure] ?? MEASURE_COL.revenue;
  const limit = Math.min(opts.limit ?? 40, 100);
  const params: unknown[] = [opts.fromYm, opts.toYm];
  let ownerJoin = "";
  let ownerWhere = "";
  if (opts.mineOf?.trim()) {
    params.push(opts.mineOf.trim());
    ownerJoin = "JOIN ic_inventory inv ON inv.code = h.item_code";
    ownerWhere = `AND EXISTS (SELECT 1 FROM odg_group_responsible gr
                   WHERE gr.employee_code = $${params.length}
                     AND gr.group_main = inv.group_main
                     AND (gr.group_sub = '' OR gr.group_sub = inv.group_sub))`;
  }
  const { rows } = await pool.query<{ code: string; name: string; ym: number; val: string }>(
    `SELECT ${d.group} AS code, ${d.name} AS name,
            (h.year_doc*100 + h.month_doc) AS ym,
            SUM(${measure})::float8 AS val
       FROM odg_pm_price_history h
       ${ownerJoin}
      WHERE (h.year_doc*100 + h.month_doc) BETWEEN $1 AND $2 ${ownerWhere}
      GROUP BY ${d.group}, (h.year_doc*100 + h.month_doc)`,
    params,
  );

  const monthsSet = new Set<number>();
  const byCode = new Map<string, PivotRow>();
  const colTotals: Record<number, number> = {};
  let grandTotal = 0;
  for (const r of rows) {
    const ym = Number(r.ym);
    const val = Number(r.val) || 0;
    monthsSet.add(ym);
    let row = byCode.get(r.code);
    if (!row) {
      row = { code: r.code, name: r.name || r.code || "—", cells: {}, total: 0 };
      byCode.set(r.code, row);
    }
    row.cells[ym] = (row.cells[ym] ?? 0) + val;
    row.total += val;
    colTotals[ym] = (colTotals[ym] ?? 0) + val;
    grandTotal += val;
  }
  const months = [...monthsSet].sort((a, b) => a - b);
  const allRows = [...byCode.values()].sort((a, b) => b.total - a.total).slice(0, limit);
  return { months, rows: allRows, colTotals, grandTotal };
}

export type MarginRow = { code: string; name: string; revenue: string; cost: string; profit: string; qty: string };
export type MarginTotals = { revenue: string; cost: string; profit: string; qty: string; lines: number };

export async function getMarginReport(opts: {
  dim: MarginDim;
  fromYm: number; // e.g. 202607
  toYm: number;
  mineOf?: string;
  limit?: number;
}): Promise<{ rows: MarginRow[]; totals: MarginTotals }> {
  const d = DIM_SQL[opts.dim] ?? DIM_SQL.brand;
  const limit = Math.min(opts.limit ?? 100, 500);
  const params: unknown[] = [opts.fromYm, opts.toYm];
  let ownerJoin = "";
  let ownerWhere = "";
  if (opts.mineOf?.trim()) {
    params.push(opts.mineOf.trim());
    ownerJoin = "JOIN ic_inventory inv ON inv.code = h.item_code";
    ownerWhere = `AND EXISTS (SELECT 1 FROM odg_group_responsible gr
                   WHERE gr.employee_code = $${params.length}
                     AND gr.group_main = inv.group_main
                     AND (gr.group_sub = '' OR gr.group_sub = inv.group_sub))`;
  }
  const whereYm = `(h.year_doc*100 + h.month_doc) BETWEEN $1 AND $2`;

  const [rowsRes, totalRes] = await Promise.all([
    pool.query<MarginRow>(
      `SELECT ${d.group} AS code, ${d.name} AS name,
              SUM(h.sum_amount)::text AS revenue,
              SUM(h.sum_of_cost)::text AS cost,
              SUM(h.profit)::text AS profit,
              SUM(h.qty)::text AS qty
         FROM odg_pm_price_history h
         ${ownerJoin}
        WHERE ${whereYm} ${ownerWhere}
        GROUP BY ${d.group}
        ORDER BY SUM(h.profit) DESC NULLS LAST
        LIMIT ${limit}`,
      params,
    ),
    pool.query<MarginTotals>(
      `SELECT COALESCE(SUM(h.sum_amount),0)::text AS revenue,
              COALESCE(SUM(h.sum_of_cost),0)::text AS cost,
              COALESCE(SUM(h.profit),0)::text AS profit,
              COALESCE(SUM(h.qty),0)::text AS qty,
              COUNT(*)::int AS lines
         FROM odg_pm_price_history h
         ${ownerJoin}
        WHERE ${whereYm} ${ownerWhere}`,
      params,
    ),
  ]);

  return { rows: rowsRes.rows, totals: totalRes.rows[0] };
}
