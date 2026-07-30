import { pool } from "@/lib/db";

// A-5 auto replenishment: items whose on-hand + on-order is below min → suggest an
// order up to max (or min), grouped by the item's last-buy supplier, so each group
// becomes one draft PO. Builds on odg_min_stock_setting (min/max) + odg_po_remain
// (incoming) + ic_trans (last-buy supplier & price).

export type ReplenishItem = {
  code: string;
  name: string;
  brand: string;
  balance: string;
  incoming: string;
  min: string;
  max: string | null;
  need: string;
  supplier_code: string;
  supplier_name: string;
  last_price: string;
  currency_code: string;
  unit: string;
  stand_value: string;
  divide_value: string;
};

export async function getReplenishmentPlan(mineOf = "", limit = 300): Promise<ReplenishItem[]> {
  const params: unknown[] = [];
  let owner = "";
  if (mineOf.trim()) {
    params.push(mineOf.trim());
    owner = `AND EXISTS (SELECT 1 FROM odg_group_responsible gr
               WHERE gr.employee_code = $${params.length}
                 AND gr.group_main = i.group_main
                 AND (gr.group_sub = '' OR gr.group_sub = i.group_sub))`;
  }
  const { rows } = await pool.query<ReplenishItem>(
    `SELECT i.code,
            COALESCE(i.name_1, '') AS name,
            COALESCE(br.name_1, i.item_brand, '') AS brand,
            COALESCE(i.balance_qty, 0)::text AS balance,
            COALESCE(po.incoming, 0)::text AS incoming,
            m.min_qty::text AS min,
            m.max_qty::text AS max,
            GREATEST(0, COALESCE(m.max_qty, m.min_qty) - COALESCE(i.balance_qty, 0) - COALESCE(po.incoming, 0))::text AS need,
            COALESCE(lb.cust_code, '') AS supplier_code,
            COALESCE(lb.supplier_name, lb.cust_code, '') AS supplier_name,
            COALESCE(lb.price, 0)::text AS last_price,
            COALESCE(NULLIF(lb.currency_code, ''), '01') AS currency_code,
            COALESCE(NULLIF(i.unit_standard_name, ''), i.unit_standard, '') AS unit,
            COALESCE(NULLIF(i.unit_standard_stand_value, 0), 1)::text AS stand_value,
            COALESCE(NULLIF(i.unit_standard_divide_value, 0), 1)::text AS divide_value
       FROM odg_min_stock_setting m
       JOIN ic_inventory i ON i.code = m.item_code
       LEFT JOIN ic_brand br ON br.code = i.item_brand
       LEFT JOIN LATERAL (
         SELECT SUM(r.qty_balance) AS incoming FROM odg_po_remain r WHERE r.item_code = i.code
       ) po ON true
       LEFT JOIN LATERAL (
         SELECT h.cust_code, s.name_1 AS supplier_name, d.price, h.currency_code
           FROM ic_trans_detail d
           JOIN ic_trans h ON h.doc_no = d.doc_no AND h.trans_flag = 6
           LEFT JOIN ap_supplier s ON s.code = h.cust_code
          WHERE d.item_code = i.code AND d.trans_flag = 6
          ORDER BY h.doc_date DESC NULLS LAST, h.doc_no DESC
          LIMIT 1
       ) lb ON true
      WHERE m.min_qty IS NOT NULL
        AND COALESCE(i.balance_qty, 0) + COALESCE(po.incoming, 0) < m.min_qty
        ${owner}
      ORDER BY COALESCE(lb.cust_code, 'zzzz'), i.code
      LIMIT ${Math.min(limit, 500)}`,
    params,
  );
  return rows;
}

export type ReplenishGroup = { supplier_code: string; supplier_name: string; currency_code: string; items: ReplenishItem[] };

// Group the plan by last-buy supplier (items with no known supplier go last, code '').
export function groupBySupplier(items: ReplenishItem[]): ReplenishGroup[] {
  const map = new Map<string, ReplenishGroup>();
  for (const it of items) {
    const key = it.supplier_code || "";
    let g = map.get(key);
    if (!g) {
      g = { supplier_code: key, supplier_name: it.supplier_name || "— ບໍ່ຮູ້ຜູ້ສະໜອງ —", currency_code: it.currency_code, items: [] };
      map.set(key, g);
    }
    g.items.push(it);
  }
  return [...map.values()].sort((a, b) => (a.supplier_code === "" ? 1 : b.supplier_code === "" ? -1 : a.supplier_name.localeCompare(b.supplier_name)));
}
