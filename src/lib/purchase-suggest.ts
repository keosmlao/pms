import { pool } from "@/lib/db";

export type SuggestRow = {
  code: string;
  name: string;
  brand: string;
  unit: string;
  supplier_code: string;
  supplier_name: string;
  stock: string;
  incoming: string;
  sale_month: string;
  dii_target: string;
  dii_actual: string | null; // months of cover = (stock + incoming) / sale_month
  target_stock: string;
  recommend_buy: string;
};

export type SuggestSummary = {
  need_buy: number;
  total_qty: string;
  shown: number;
};

// Catalog-wide purchase recommendation for one BU:
//   recommend = max(0, sale_month × DII target − stock − incoming)
// Only items that have a brand-level stock policy and a positive sales rate.
export async function getSuggestions(
  groupMain: string,
  opts: { brand?: string; q?: string; limit?: number } = {},
): Promise<{ rows: SuggestRow[]; summary: SuggestSummary }> {
  const limit = Math.min(opts.limit ?? 200, 5000);
  const params: unknown[] = [groupMain];
  const filters: string[] = [];
  if (opts.brand?.trim()) {
    params.push(opts.brand.trim().toUpperCase());
    filters.push(`UPPER(COALESCE(i.item_brand,'')) = $${params.length}`);
  }
  if (opts.q?.trim()) {
    params.push(`%${opts.q.trim()}%`);
    filters.push(`(i.code ILIKE $${params.length} OR i.name_1 ILIKE $${params.length})`);
  }
  const extra = filters.length ? `AND ${filters.join(" AND ")}` : "";

  const baseCte = `
    WITH base AS (
      SELECT i.code,
             COALESCE(i.name_1,'') AS name,
             COALESCE(i.item_brand,'') AS brand,
             COALESCE(NULLIF(i.unit_standard_name,''), i.unit_standard, '') AS unit,
             COALESCE(lb.supplier_code,'') AS supplier_code,
             COALESCE(sup.name_1, lb.supplier_code, '') AS supplier_name,
             COALESCE(i.balance_qty,0) AS stock,
             COALESCE(ag.avgsale,0) AS sale_month,
             (sp.sale_months + sp.stock_months) AS dii_target,
             COALESCE((SELECT SUM(r.qty_balance) FROM odg_po_remain r WHERE r.item_code = i.code), 0) AS incoming
        FROM ic_inventory i
        JOIN odg_stock_policy sp
          ON sp.group_main = i.group_main
         AND sp.brand = UPPER(COALESCE(i.item_brand,''))
         AND sp.supplier_name = ''
        LEFT JOIN odg_stock_aging ag ON ag.ic_code = i.code
        LEFT JOIN LATERAL (
          SELECT t.cust_code AS supplier_code
            FROM ic_trans_detail d
            JOIN ic_trans t ON t.doc_no = d.doc_no AND t.trans_flag = d.trans_flag
           WHERE d.item_code = i.code AND d.trans_flag = 12 AND d.last_status = 0
           ORDER BY d.doc_date DESC NULLS LAST, d.doc_no DESC
           LIMIT 1
        ) lb ON true
        LEFT JOIN ap_supplier sup ON sup.code = lb.supplier_code
       WHERE i.group_main = $1
         AND COALESCE(ag.avgsale,0) > 0
         ${extra}
    ), calc AS (
      SELECT *,
             ROUND(sale_month * dii_target) AS target_stock,
             GREATEST(0, ROUND(sale_month * dii_target - stock - incoming)) AS recommend_buy
        FROM base
    )`;

  const rowsRes = await pool.query<SuggestRow>(
    `${baseCte}
     SELECT code, name, brand, unit, supplier_code, supplier_name,
            stock::text, incoming::text, ROUND(sale_month,1)::text AS sale_month,
            dii_target::text,
            CASE WHEN sale_month > 0 THEN ROUND((stock + incoming) / sale_month, 1)::text END AS dii_actual,
            target_stock::text,
            recommend_buy
       FROM calc
      WHERE recommend_buy > 0
      ORDER BY recommend_buy DESC
      LIMIT ${limit}`,
    params,
  );

  const sumRes = await pool.query<{ need_buy: number; total_qty: string }>(
    `${baseCte}
     SELECT COUNT(*) FILTER (WHERE recommend_buy > 0)::int AS need_buy,
            COALESCE(SUM(recommend_buy) FILTER (WHERE recommend_buy > 0),0)::text AS total_qty
       FROM calc`,
    params,
  );

  return {
    rows: rowsRes.rows,
    summary: {
      need_buy: sumRes.rows[0]?.need_buy ?? 0,
      total_qty: sumRes.rows[0]?.total_qty ?? "0",
      shown: rowsRes.rows.length,
    },
  };
}

// Distinct brands that have a policy in this BU (for the filter dropdown).
export async function getPolicyBrands(groupMain: string): Promise<string[]> {
  const { rows } = await pool.query<{ brand: string }>(
    `SELECT DISTINCT brand FROM odg_stock_policy
      WHERE group_main = $1 AND supplier_name = '' ORDER BY brand`,
    [groupMain],
  );
  return rows.map((r) => r.brand);
}
