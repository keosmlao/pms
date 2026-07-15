import { pool } from "@/lib/db";

export type SamsungSnSummary = {
  total: number;
  claimed: number;
  unclaimed: number;
  claimed_sold: number;
  sold_unclaimed: number;
  claimed_in_stock: number;
  claimed_unmatched: number;
};

export type SamsungSnFilter = "all" | "claimed" | "unclaimed" | "claimed_sold" | "sold_unclaimed" | "claimed_stock";

export type SamsungSnRow = {
  item_code: string;
  item_name: string;
  model: string;
  serial_no: string;
  claim_note: string;
  is_claimed: boolean;
  stock_status: number | null;
  wh_code: string;
  wh_name: string;
  rack: string;
  rack_name: string;
  location: string;
  location_name: string;
  record_date: string | null;
  bill_no: string;
};

// One current row per physical Samsung serial. A non-empty claim_note means
// the serial was claimed in the Samsung source file.
const SERIAL_CTE = `WITH samsung AS (
  SELECT DISTINCT ON (TRIM(serial_no))
         TRIM(serial_no) AS serial_no,
         COALESCE(item_code, '') AS source_item_code,
         COALESCE(product_name, '') AS source_product_name,
         COALESCE(bill_no, '') AS bill_no,
         COALESCE(claim_note, '') AS claim_note,
         record_date
    FROM wms_samsung_serial
   WHERE COALESCE(TRIM(serial_no), '') <> ''
   ORDER BY TRIM(serial_no), record_date DESC NULLS LAST, samsung_serial_id DESC
)`;

export async function getSamsungSnSummary(): Promise<SamsungSnSummary> {
  const { rows } = await pool.query<SamsungSnSummary>(
    `${SERIAL_CTE}
     SELECT count(*)::int AS total,
            count(*) FILTER (WHERE NULLIF(TRIM(s.claim_note), '') IS NOT NULL)::int AS claimed,
            count(*) FILTER (WHERE NULLIF(TRIM(s.claim_note), '') IS NULL)::int AS unclaimed,
            count(*) FILTER (WHERE NULLIF(TRIM(s.claim_note), '') IS NOT NULL AND inv.status = 1)::int AS claimed_sold,
            count(*) FILTER (WHERE NULLIF(TRIM(s.claim_note), '') IS NULL AND inv.status = 1)::int AS sold_unclaimed,
            count(*) FILTER (WHERE NULLIF(TRIM(s.claim_note), '') IS NOT NULL AND COALESCE(inv.status, 0) = 0 AND inv.sn IS NOT NULL)::int AS claimed_in_stock,
            count(*) FILTER (WHERE NULLIF(TRIM(s.claim_note), '') IS NOT NULL AND inv.sn IS NULL)::int AS claimed_unmatched
       FROM samsung s
       LEFT JOIN LATERAL (
         SELECT si.sn, si.status
           FROM sn_inventory si
          WHERE si.sn = s.serial_no
          ORDER BY si.create_date_time_now DESC NULLS LAST
          LIMIT 1
       ) inv ON true`,
  );
  return rows[0] ?? { total: 0, claimed: 0, unclaimed: 0, claimed_sold: 0, sold_unclaimed: 0, claimed_in_stock: 0, claimed_unmatched: 0 };
}

export async function getSamsungSerials(query = "", filter: SamsungSnFilter = "all", limit = 300): Promise<SamsungSnRow[]> {
  const params: unknown[] = [];
  const clauses: string[] = [];

  if (query.trim()) {
    params.push(`%${query.trim()}%`);
    clauses.push(`(s.serial_no ILIKE $${params.length}
      OR COALESCE(inv.item_code, s.source_item_code) ILIKE $${params.length}
      OR COALESCE(i.name_1, s.source_product_name) ILIKE $${params.length}
      OR COALESCE(i.item_model, '') ILIKE $${params.length}
      OR s.bill_no ILIKE $${params.length}
      OR s.claim_note ILIKE $${params.length})`);
  }
  if (filter === "claimed") clauses.push("NULLIF(TRIM(s.claim_note), '') IS NOT NULL");
  if (filter === "unclaimed") clauses.push("NULLIF(TRIM(s.claim_note), '') IS NULL");
  if (filter === "claimed_sold") clauses.push("NULLIF(TRIM(s.claim_note), '') IS NOT NULL AND inv.status = 1");
  if (filter === "sold_unclaimed") clauses.push("NULLIF(TRIM(s.claim_note), '') IS NULL AND inv.status = 1");
  if (filter === "claimed_stock") clauses.push("NULLIF(TRIM(s.claim_note), '') IS NOT NULL AND COALESCE(inv.status, 0) = 0 AND inv.sn IS NOT NULL");

  params.push(Math.max(1, Math.min(limit, 500)));
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const { rows } = await pool.query<SamsungSnRow>(
    `${SERIAL_CTE}
     SELECT COALESCE(inv.item_code, s.source_item_code) AS item_code,
            COALESCE(NULLIF(i.name_1, ''), s.source_product_name) AS item_name,
            COALESCE(i.item_model, '') AS model,
            s.serial_no,
            s.claim_note,
            (NULLIF(TRIM(s.claim_note), '') IS NOT NULL) AS is_claimed,
            inv.status::int AS stock_status,
            COALESCE(inv.wh_code, '') AS wh_code,
            COALESCE(w.name_1, '') AS wh_name,
            COALESCE(inv.rack, '') AS rack,
            COALESCE(rack.name_1, '') AS rack_name,
            COALESCE(inv.location, '') AS location,
            COALESCE(location.name_1, '') AS location_name,
            s.record_date::text AS record_date,
            s.bill_no
       FROM samsung s
       LEFT JOIN LATERAL (
         SELECT si.sn, si.item_code, si.status, si.wh_code, si.rack, si.location
           FROM sn_inventory si
          WHERE si.sn = s.serial_no
          ORDER BY si.create_date_time_now DESC NULLS LAST
          LIMIT 1
       ) inv ON true
       LEFT JOIN ic_inventory i ON i.code = COALESCE(inv.item_code, s.source_item_code)
       LEFT JOIN ic_warehouse w ON w.code = inv.wh_code
       LEFT JOIN odg_wms_location rack ON rack.code = inv.rack AND rack.wh_code = inv.wh_code
       LEFT JOIN odg_wms_location1 location ON location.code = inv.location AND location.wh_code = inv.wh_code
       ${where}
      ORDER BY s.record_date DESC NULLS LAST, s.serial_no
      LIMIT $${params.length}`,
    params,
  );
  return rows;
}
