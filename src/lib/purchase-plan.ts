import { pool } from "@/lib/db";

export type PlanItem = {
  id: number;
  item_code: string;
  name: string;
  brand: string;
  plan_qty: string;
  supplier_code: string;
  supplier_name: string;
  target_date: string | null;
  note: string;
  status: string;
  balance: string;
  avg_sale: string;
};

export async function getPlanItems(status = "planned"): Promise<PlanItem[]> {
  const { rows } = await pool.query<PlanItem>(
    `SELECT p.id, p.item_code, COALESCE(i.name_1,'') AS name,
            COALESCE(br.name_1, i.item_brand, '') AS brand,
            p.plan_qty::text AS plan_qty,
            COALESCE(p.supplier_code,'') AS supplier_code,
            COALESCE(s.name_1, p.supplier_code, '') AS supplier_name,
            p.target_date::text AS target_date,
            COALESCE(p.note,'') AS note, p.status,
            COALESCE(i.balance_qty,0)::text AS balance,
            COALESCE(a.avgsale,0)::text AS avg_sale
       FROM odg_purchase_plan_item p
       LEFT JOIN ic_inventory i ON i.code = p.item_code
       LEFT JOIN ic_brand br ON br.code = i.item_brand
       LEFT JOIN ap_supplier s ON s.code = p.supplier_code
       LEFT JOIN odg_stock_aging a ON a.ic_code = p.item_code
      WHERE p.status = $1
      ORDER BY COALESCE(s.name_1, p.supplier_code, 'zzz'), p.created_at`,
    [status],
  );
  return rows;
}

export async function getPlanCount(status = "planned"): Promise<number> {
  const { rows } = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM odg_purchase_plan_item WHERE status = $1`,
    [status],
  );
  return rows[0]?.n ?? 0;
}
