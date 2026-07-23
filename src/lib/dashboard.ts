import { pool } from "@/lib/db";

const STOCK_IN_FLAGS = "ARRAY[12,48,54,58,68,70]";
const STOCK_OUT_FLAGS = "ARRAY[44,56,66,72]";
const STOCK_ALL_FLAGS = "ARRAY[12,48,54,58,68,70,44,56,66,72]";

export type DailyStockRow = {
  date: string;
  opening: number;
  received: number;
  issued: number;
  closing: number;
};

export type TopMover = {
  code: string;
  name: string;
  received: number;
  issued: number;
};

export type CategoryMovement = {
  code: string;
  name: string;
  opening: number;
  received: number;
  issued: number;
  closing: number;
};

export type WarehouseMovement = {
  warehouse: string;
  wh_name: string;
  received: number;
  issued: number;
  closing: number;
};

export type WarehouseOption = { code: string; name: string };

export type DashboardStock = {
  today: DailyStockRow;
  daily: DailyStockRow[];
  topMovers: TopMover[];
  categoryMovements: CategoryMovement[];
  warehouseMovements: WarehouseMovement[];
  warehouses: WarehouseOption[];
  stockedProducts: number;
  scope: "mine" | "all";
  selectedWarehouses: string[];
};

export type DashboardOptions = {
  employeeCode?: string | null;
  scope?: "mine" | "all";
  warehouses?: string[];
};

type MovementRow = {
  date: string;
  received: string;
  issued: string;
};

// Responsible-group scope: only items in one of the employee's owned groups.
// Mirrors the products list filter (odg_group_responsible by group_main/group_sub).
function respClause(invAlias: string, employeeCode: string | null | undefined, mine: boolean, params: unknown[]) {
  if (!mine || !employeeCode) return "";
  params.push(employeeCode);
  return ` AND EXISTS (SELECT 1 FROM odg_group_responsible gr
             WHERE gr.employee_code = $${params.length}
               AND gr.group_main = ${invAlias}.group_main
               AND (gr.group_sub = '' OR gr.group_sub = ${invAlias}.group_sub))`;
}
function whClause(col: string, list: string[], params: unknown[]) {
  if (!list.length) return "";
  params.push(list);
  return ` AND ${col} = ANY($${params.length})`;
}

export async function getDashboardStock(opts: DashboardOptions = {}): Promise<DashboardStock> {
  const scope: "mine" | "all" = opts.scope === "mine" ? "mine" : "all";
  const mine = scope === "mine";
  const emp = opts.employeeCode ?? null;
  const whList = (opts.warehouses ?? []).map((w) => w.trim()).filter(Boolean);
  const hasWh = whList.length > 0;

  // Balance / closing: use the total inventory balance when browsing all warehouses
  // (keeps parity with the familiar figure); switch to per-warehouse location balance
  // when one or more warehouses are selected.
  const balanceParams: unknown[] = [];
  const balanceSql = hasWh
    ? `SELECT COALESCE(SUM(l.balance_qty), 0)::text AS closing,
              COUNT(DISTINCT l.ic_code) FILTER (WHERE l.balance_qty > 0)::int AS stocked_products
         FROM odg_stock_warehouse_location l
         JOIN ic_inventory i ON i.code = l.ic_code
        WHERE l.warehouse = ANY($${(balanceParams.push(whList), balanceParams.length)})${respClause("i", emp, mine, balanceParams)}`
    : `SELECT COALESCE(SUM(i.balance_qty), 0)::text AS closing,
              COUNT(*) FILTER (WHERE i.balance_qty > 0)::int AS stocked_products
         FROM ic_inventory i
        WHERE TRUE${respClause("i", emp, mine, balanceParams)}`;

  const dailyParams: unknown[] = [];
  const dailyResp = respClause("i", emp, mine, dailyParams);
  const dailyWh = whClause("d.wh_code", whList, dailyParams);

  const moverParams: unknown[] = [];
  const moverResp = respClause("i", emp, mine, moverParams);
  const moverWh = whClause("d.wh_code", whList, moverParams);

  const catParams: unknown[] = [];
  const catMovResp = respClause("i", emp, mine, catParams);
  const catMovWh = whClause("d.wh_code", whList, catParams);
  const catBalSql = hasWh
    ? `SELECT COALESCE(i.item_category, '') AS category_code, SUM(l.balance_qty) AS closing
         FROM odg_stock_warehouse_location l
         JOIN ic_inventory i ON i.code = l.ic_code
        WHERE l.warehouse = ANY($${(catParams.push(whList), catParams.length)})${respClause("i", emp, mine, catParams)}
        GROUP BY COALESCE(i.item_category, '')`
    : `SELECT COALESCE(i.item_category, '') AS category_code, SUM(i.balance_qty) AS closing
         FROM ic_inventory i
        WHERE TRUE${respClause("i", emp, mine, catParams)}
        GROUP BY COALESCE(i.item_category, '')`;

  // Warehouse breakdown shows every warehouse (independent of the dropdown) so the
  // user can compare — scoped only by responsibility.
  const whbParams: unknown[] = [];
  const whbMovResp = respClause("i", emp, mine, whbParams);
  const whbBalResp = respClause("i", emp, mine, whbParams);

  const [balanceResult, dailyResult, moverResult, categoryResult, warehouseResult, warehouseOptions] =
    await Promise.all([
      pool.query<{ closing: string; stocked_products: number }>(balanceSql, balanceParams),
      pool.query<MovementRow>(
        `WITH days AS (
           SELECT generate_series(CURRENT_DATE - 6, CURRENT_DATE, interval '1 day')::date AS date
         ), movement AS (
           SELECT d.doc_date::date AS date,
                  SUM(CASE WHEN d.trans_flag = ANY(${STOCK_IN_FLAGS}) THEN d.qty ELSE 0 END) AS received,
                  SUM(CASE WHEN d.trans_flag = ANY(${STOCK_OUT_FLAGS}) THEN d.qty ELSE 0 END) AS issued
             FROM ic_trans_detail d
             LEFT JOIN ic_inventory i ON i.code = d.item_code
            WHERE d.last_status = 0
              AND d.trans_flag = ANY(${STOCK_ALL_FLAGS})
              AND d.doc_date >= CURRENT_DATE - 6
              AND d.doc_date < CURRENT_DATE + 1${dailyResp}${dailyWh}
            GROUP BY d.doc_date::date
         )
         SELECT days.date::text AS date,
                COALESCE(movement.received, 0)::text AS received,
                COALESCE(movement.issued, 0)::text AS issued
           FROM days
           LEFT JOIN movement USING (date)
          ORDER BY days.date DESC`,
        dailyParams,
      ),
      pool.query<{ code: string; name: string; received: string; issued: string }>(
        `SELECT d.item_code AS code,
                COALESCE(NULLIF(i.name_1, ''), NULLIF(i.name_eng_1, ''), d.item_code) AS name,
                SUM(CASE WHEN d.trans_flag = ANY(${STOCK_IN_FLAGS}) THEN d.qty ELSE 0 END)::text AS received,
                SUM(CASE WHEN d.trans_flag = ANY(${STOCK_OUT_FLAGS}) THEN d.qty ELSE 0 END)::text AS issued
           FROM ic_trans_detail d
           LEFT JOIN ic_inventory i ON i.code = d.item_code
          WHERE d.last_status = 0
            AND d.trans_flag = ANY(${STOCK_ALL_FLAGS})
            AND d.doc_date >= CURRENT_DATE
            AND d.doc_date < CURRENT_DATE + 1${moverResp}${moverWh}
          GROUP BY d.item_code, i.name_1, i.name_eng_1
          ORDER BY SUM(d.qty) DESC, d.item_code
          LIMIT 8`,
        moverParams,
      ),
      pool.query<{ code: string; name: string; closing: string; received: string; issued: string }>(
        `WITH movement AS (
           SELECT COALESCE(i.item_category, '') AS category_code,
                  SUM(CASE WHEN d.trans_flag = ANY(${STOCK_IN_FLAGS}) THEN d.qty ELSE 0 END) AS received,
                  SUM(CASE WHEN d.trans_flag = ANY(${STOCK_OUT_FLAGS}) THEN d.qty ELSE 0 END) AS issued
             FROM ic_trans_detail d
             LEFT JOIN ic_inventory i ON i.code = d.item_code
            WHERE d.last_status = 0
              AND d.trans_flag = ANY(${STOCK_ALL_FLAGS})
              AND d.doc_date >= CURRENT_DATE
              AND d.doc_date < CURRENT_DATE + 1${catMovResp}${catMovWh}
            GROUP BY COALESCE(i.item_category, '')
         ), balance AS (
           ${catBalSql}
         )
         SELECT COALESCE(movement.category_code, balance.category_code) AS code,
                COALESCE(NULLIF(category.name_1, ''), 'ບໍ່ລະບຸໝວດ') AS name,
                COALESCE(balance.closing, 0)::text AS closing,
                COALESCE(movement.received, 0)::text AS received,
                COALESCE(movement.issued, 0)::text AS issued
           FROM movement
           FULL OUTER JOIN balance USING (category_code)
           LEFT JOIN ic_category category ON category.code = COALESCE(movement.category_code, balance.category_code)
          ORDER BY (COALESCE(movement.received, 0) + COALESCE(movement.issued, 0)) DESC,
                   COALESCE(movement.category_code, balance.category_code)`,
        catParams,
      ),
      pool.query<{ warehouse: string; wh_name: string; received: string; issued: string; closing: string }>(
        `WITH mv AS (
           SELECT d.wh_code AS warehouse,
                  SUM(CASE WHEN d.trans_flag = ANY(${STOCK_IN_FLAGS}) THEN d.qty ELSE 0 END) AS received,
                  SUM(CASE WHEN d.trans_flag = ANY(${STOCK_OUT_FLAGS}) THEN d.qty ELSE 0 END) AS issued
             FROM ic_trans_detail d
             LEFT JOIN ic_inventory i ON i.code = d.item_code
            WHERE d.last_status = 0
              AND d.trans_flag = ANY(${STOCK_ALL_FLAGS})
              AND d.doc_date >= CURRENT_DATE
              AND d.doc_date < CURRENT_DATE + 1${whbMovResp}
            GROUP BY d.wh_code
         ), bal AS (
           SELECT l.warehouse, SUM(l.balance_qty) AS closing
             FROM odg_stock_warehouse_location l
             JOIN ic_inventory i ON i.code = l.ic_code
            WHERE TRUE${whbBalResp}
            GROUP BY l.warehouse
         )
         SELECT COALESCE(mv.warehouse, bal.warehouse) AS warehouse,
                COALESCE(w.name_1, '') AS wh_name,
                COALESCE(mv.received, 0)::text AS received,
                COALESCE(mv.issued, 0)::text AS issued,
                COALESCE(bal.closing, 0)::text AS closing
           FROM bal
           FULL OUTER JOIN mv ON mv.warehouse = bal.warehouse
           LEFT JOIN ic_warehouse w ON w.code = COALESCE(mv.warehouse, bal.warehouse)
          WHERE COALESCE(mv.warehouse, bal.warehouse) <> ''
          ORDER BY bal.closing DESC NULLS LAST, mv.warehouse`,
        whbParams,
      ),
      pool.query<{ code: string; name: string }>(
        `SELECT code, COALESCE(name_1, code) AS name FROM ic_warehouse WHERE code <> '' ORDER BY code`,
      ),
    ]);

  let rollingClosing = Number(balanceResult.rows[0]?.closing ?? 0);
  const dailyDescending = dailyResult.rows.map((row) => {
    const received = Number(row.received);
    const issued = Number(row.issued);
    const closing = rollingClosing;
    const opening = closing - received + issued;
    rollingClosing = opening;
    return { date: row.date, opening, received, issued, closing };
  });

  const today = dailyDescending[0] ?? {
    date: new Date().toISOString().slice(0, 10),
    opening: rollingClosing,
    received: 0,
    issued: 0,
    closing: rollingClosing,
  };

  return {
    today,
    daily: dailyDescending,
    topMovers: moverResult.rows.map((row) => ({
      code: row.code,
      name: row.name,
      received: Number(row.received),
      issued: Number(row.issued),
    })),
    categoryMovements: categoryResult.rows.map((row) => {
      const received = Number(row.received);
      const issued = Number(row.issued);
      const closing = Number(row.closing);
      return {
        code: row.code,
        name: row.name,
        opening: closing - received + issued,
        received,
        issued,
        closing,
      };
    }),
    warehouseMovements: warehouseResult.rows.map((row) => ({
      warehouse: row.warehouse,
      wh_name: row.wh_name,
      received: Number(row.received),
      issued: Number(row.issued),
      closing: Number(row.closing),
    })),
    warehouses: warehouseOptions.rows,
    stockedProducts: balanceResult.rows[0]?.stocked_products ?? 0,
    scope,
    selectedWarehouses: whList,
  };
}
