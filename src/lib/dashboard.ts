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

export type DashboardStock = {
  today: DailyStockRow;
  daily: DailyStockRow[];
  topMovers: TopMover[];
  categoryMovements: CategoryMovement[];
  stockedProducts: number;
};

type MovementRow = {
  date: string;
  received: string;
  issued: string;
};

export async function getDashboardStock(): Promise<DashboardStock> {
  const [balanceResult, dailyResult, moverResult, categoryResult] = await Promise.all([
    pool.query<{ closing: string; stocked_products: number }>(
      `SELECT COALESCE(SUM(balance_qty), 0)::text AS closing,
              COUNT(*) FILTER (WHERE balance_qty > 0)::int AS stocked_products
         FROM ic_inventory`,
    ),
    pool.query<MovementRow>(
      `WITH days AS (
         SELECT generate_series(CURRENT_DATE - 6, CURRENT_DATE, interval '1 day')::date AS date
       ), movement AS (
         SELECT doc_date::date AS date,
                SUM(CASE WHEN trans_flag = ANY(${STOCK_IN_FLAGS}) THEN qty ELSE 0 END) AS received,
                SUM(CASE WHEN trans_flag = ANY(${STOCK_OUT_FLAGS}) THEN qty ELSE 0 END) AS issued
           FROM ic_trans_detail
          WHERE last_status = 0
            AND trans_flag = ANY(${STOCK_ALL_FLAGS})
            AND doc_date >= CURRENT_DATE - 6
            AND doc_date < CURRENT_DATE + 1
          GROUP BY doc_date::date
       )
       SELECT days.date::text AS date,
              COALESCE(movement.received, 0)::text AS received,
              COALESCE(movement.issued, 0)::text AS issued
         FROM days
         LEFT JOIN movement USING (date)
        ORDER BY days.date DESC`,
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
          AND d.doc_date < CURRENT_DATE + 1
        GROUP BY d.item_code, i.name_1, i.name_eng_1
        ORDER BY SUM(d.qty) DESC, d.item_code
        LIMIT 8`,
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
            AND d.doc_date < CURRENT_DATE + 1
          GROUP BY COALESCE(i.item_category, '')
       ), balance AS (
         SELECT COALESCE(item_category, '') AS category_code,
                SUM(balance_qty) AS closing
           FROM ic_inventory
          GROUP BY COALESCE(item_category, '')
       )
       SELECT movement.category_code AS code,
              COALESCE(NULLIF(category.name_1, ''), 'ບໍ່ລະບຸໝວດ') AS name,
              COALESCE(balance.closing, 0)::text AS closing,
              movement.received::text AS received,
              movement.issued::text AS issued
         FROM movement
         LEFT JOIN balance USING (category_code)
         LEFT JOIN ic_category category ON category.code = movement.category_code
        ORDER BY (movement.received + movement.issued) DESC, movement.category_code`,
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
    stockedProducts: balanceResult.rows[0]?.stocked_products ?? 0,
  };
}
