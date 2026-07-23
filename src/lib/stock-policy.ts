import { pool } from "@/lib/db";

export const BU_LABELS: Record<string, string> = {
  "11": "CE · ເຄື່ອງໃຊ້ໄຟຟ້າພາຍໃນບ້ານ",
  "12": "AIR · ແອ",
  "13": "PIPE · ປະປາ ໄຟຟ້າ ກໍ່ສ້າງ ກະເສດ",
  "14": "SPAREPART · ອາໄຫຼ່ ອຸປະກອນ ເຄື່ອງມື",
};

export type PolicyRow = {
  id: number;
  group_main: string;
  brand: string;
  supplier_name: string;
  sale_share: string | null;
  sale_months: string;
  stock_months: string;
  reason: string;
  // live figures (brand-level rows only)
  stock_qty: string;
  sale_per_month: string;
  dii_actual: string | null; // months of stock at current sales rate
};

// Brand-level policies for one BU with live DII from the ERP:
// stock qty from ic_inventory, monthly sales rate from odg_stock_aging.
export async function listPolicies(groupMain: string): Promise<PolicyRow[]> {
  const { rows } = await pool.query<PolicyRow>(
    `SELECT sp.id, sp.group_main, sp.brand, sp.supplier_name,
            sp.sale_share::text, sp.sale_months::text, sp.stock_months::text,
            COALESCE(sp.reason,'') AS reason,
            COALESCE(b.stock_qty,0)::text AS stock_qty,
            COALESCE(b.sale_per_month,0)::text AS sale_per_month,
            CASE WHEN COALESCE(b.sale_per_month,0) > 0
                 THEN ROUND(b.stock_qty / b.sale_per_month, 1)::text END AS dii_actual
       FROM odg_stock_policy sp
       LEFT JOIN LATERAL (
         SELECT SUM(COALESCE(i.balance_qty,0)) AS stock_qty,
                SUM(COALESCE(a.avgsale,0)) AS sale_per_month
           FROM ic_inventory i
           LEFT JOIN odg_stock_aging a ON a.ic_code = i.code
          WHERE i.group_main = sp.group_main
            AND UPPER(COALESCE(i.item_brand,'')) = sp.brand
       ) b ON sp.supplier_name = ''
      WHERE sp.group_main = $1
      ORDER BY (sp.supplier_name <> ''), sp.sale_share DESC NULLS LAST, sp.brand, sp.supplier_name`,
    [groupMain],
  );
  return rows;
}

export async function countOverPolicy(): Promise<{ group_main: string; over: number }[]> {
  const { rows } = await pool.query<{ group_main: string; over: number }>(
    `SELECT sp.group_main, COUNT(*)::int AS over
       FROM odg_stock_policy sp
       JOIN LATERAL (
         SELECT SUM(COALESCE(i.balance_qty,0)) AS stock_qty,
                SUM(COALESCE(a.avgsale,0)) AS sale_per_month
           FROM ic_inventory i
           LEFT JOIN odg_stock_aging a ON a.ic_code = i.code
          WHERE i.group_main = sp.group_main
            AND UPPER(COALESCE(i.item_brand,'')) = sp.brand
       ) b ON true
      WHERE sp.supplier_name = ''
        AND b.sale_per_month > 0
        AND b.stock_qty / b.sale_per_month > (sp.sale_months + sp.stock_months)
      GROUP BY sp.group_main`,
  );
  return rows;
}
