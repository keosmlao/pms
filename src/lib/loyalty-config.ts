import { pool } from "@/lib/db";

// Everything here depends on db/migrations/003_loyalty_config_standard.sql.
// Until that has been run the tables do not exist, so every read goes through
// isConfigSchemaReady() and the page shows an instruction instead of a crash.
export async function isConfigSchemaReady(): Promise<boolean> {
  const { rows } = await pool.query<{ ok: boolean }>(
    `SELECT (to_regclass('public.odg_loyalty_earn_rule') IS NOT NULL
             AND to_regclass('public.odg_loyalty_config_log') IS NOT NULL) AS ok`,
  );
  return rows[0]?.ok ?? false;
}

export type ChannelOption = { code: string; name: string };

export async function getChannelOptions(): Promise<ChannelOption[]> {
  const { rows } = await pool.query<ChannelOption>(
    `SELECT code, COALESCE(name_1, code) AS name FROM pmt_channel_group
      WHERE code IS NOT NULL AND code <> '' ORDER BY code`,
  );
  return rows;
}

export type BuOption = { code: string; name: string };

export async function getBuOptions(): Promise<BuOption[]> {
  const { rows } = await pool.query<BuOption>(
    `SELECT bu_code AS code, COALESCE(NULLIF(bu_name, ''), bu_code) AS name
       FROM mas_bu WHERE is_active AND bu_code IS NOT NULL ORDER BY bu_code`,
  );
  return rows;
}

export type EarnRule = {
  id: string;
  channel_group: string;
  channel_name: string;
  bu_code: string;
  bu_name: string;
  kip_per_point: string;
  multiplier: string;
  from_date: string;
  to_date: string | null;
  is_active: number;
  note: string;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string | null;
};

// Ordered most specific first (channel+BU before the catch-all), which is the
// order the rules are meant to be applied in.
export async function getEarnRules(): Promise<EarnRule[]> {
  const { rows } = await pool.query<EarnRule>(
    `SELECT r.id::text,
            r.channel_group,
            COALESCE(c.name_1, NULLIF(r.channel_group, ''), 'ທຸກຊ່ອງທາງ') AS channel_name,
            r.bu_code,
            COALESCE(NULLIF(b.bu_name, ''), NULLIF(r.bu_code, ''), 'ທຸກ BU') AS bu_name,
            r.kip_per_point::text, r.multiplier::text,
            r.from_date::text, r.to_date::text,
            r.is_active::int, r.note,
            r.created_by, r.created_at::text,
            r.updated_by, r.updated_at::text
       FROM odg_loyalty_earn_rule r
       LEFT JOIN pmt_channel_group c ON c.code = r.channel_group
       LEFT JOIN mas_bu b ON b.bu_code = r.bu_code
      ORDER BY (r.channel_group <> '') DESC, (r.bu_code <> '') DESC,
               r.channel_group, r.bu_code, r.from_date DESC`,
  );
  return rows;
}

export type ConfigLogEntry = {
  id: string;
  entity: string;
  entity_id: string;
  action: string;
  changed_by: string;
  changed_by_name: string;
  changed_at: string;
  summary: string;
};

export async function getConfigLog(limit = 50): Promise<ConfigLogEntry[]> {
  const { rows } = await pool.query<ConfigLogEntry>(
    `SELECT l.id::text, l.entity, l.entity_id, l.action,
            l.changed_by,
            COALESCE(e.fullname_lo, l.changed_by) AS changed_by_name,
            l.changed_at::text,
            COALESCE(l.after_json, l.before_json, '{}'::jsonb)::text AS summary
       FROM odg_loyalty_config_log l
       LEFT JOIN odg_employee e ON e.employee_code = l.changed_by
      ORDER BY l.changed_at DESC LIMIT $1`,
    [limit],
  );
  return rows;
}

// ===== ສິນຄ້າຮ່ວມລາຍການສະສົມແຕ້ມ =====
// ic_inventory_detail.have_point decides whether a line contributes to
// odg_member_point.point_amount. Verified against the ledger: point_amount
// equals the kip total of the lines whose product carries the flag.
// odg_product_info is a Lao-labelled view over the same column.

export async function isProductLogReady(): Promise<boolean> {
  const { rows } = await pool.query<{ ok: boolean }>(
    `SELECT to_regclass('public.odg_product_point_log') IS NOT NULL AS ok`,
  );
  return rows[0]?.ok ?? false;
}

export type PointGroupStat = {
  group_main: string;
  group_name: string;
  items: number;
  have_point: number;
  pct: string;
};

export async function getPointGroupStats(mineOf = ""): Promise<PointGroupStat[]> {
  const owner = mineOf.trim()
    ? `AND EXISTS (SELECT 1 FROM odg_group_responsible gr
                    WHERE gr.employee_code = $1
                      AND gr.group_main = i.group_main
                      AND (gr.group_sub = '' OR gr.group_sub = i.group_sub))`
    : "";
  const { rows } = await pool.query<PointGroupStat>(
    `SELECT i.group_main,
            COALESCE(NULLIF(g.name_1, ''), NULLIF(i.group_main, ''), '(ບໍ່ມີກຸ່ມ)') AS group_name,
            count(*)::int AS items,
            count(*) FILTER (WHERE d.have_point = 1)::int AS have_point,
            round(100.0 * count(*) FILTER (WHERE d.have_point = 1) / count(*), 1)::text AS pct
       FROM ic_inventory i
       JOIN ic_inventory_detail d ON d.ic_code = i.code
       LEFT JOIN ic_group g ON g.code = i.group_main
      WHERE true ${owner}
      GROUP BY 1, 2 ORDER BY items DESC`,
    mineOf.trim() ? [mineOf.trim()] : [],
  );
  return rows;
}

export type PointProduct = {
  code: string;
  name: string;
  group_name: string;
  brand: string;
  have_point: number;
  stockqty: string;
};

export async function countPointProducts(mineOf: string, only: string, q: string): Promise<number> {
  const b = buildProductFilter(mineOf, only, q, 1);
  const { rows } = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM ic_inventory i
       JOIN ic_inventory_detail d ON d.ic_code = i.code
      WHERE true ${b.sql}`,
    b.params,
  );
  return rows[0]?.n ?? 0;
}

function buildProductFilter(mineOf: string, only: string, q: string, start: number) {
  const parts: string[] = [];
  const params: unknown[] = [];
  let i = start;
  if (mineOf.trim()) {
    parts.push(`AND EXISTS (SELECT 1 FROM odg_group_responsible gr
                             WHERE gr.employee_code = $${i}
                               AND gr.group_main = i.group_main
                               AND (gr.group_sub = '' OR gr.group_sub = i.group_sub))`);
    params.push(mineOf.trim());
    i++;
  }
  if (only === "yes") parts.push("AND d.have_point = 1");
  if (only === "no") parts.push("AND COALESCE(d.have_point, 0) = 0");
  if (q.trim()) {
    parts.push(`AND (i.code ILIKE $${i} OR i.name_1 ILIKE $${i})`);
    params.push(`%${q.trim()}%`);
    i++;
  }
  return { sql: parts.join(" "), params };
}

export async function getPointProducts(
  mineOf: string,
  only: string,
  q: string,
  limit: number,
  offset: number,
): Promise<PointProduct[]> {
  const b = buildProductFilter(mineOf, only, q, 3);
  const { rows } = await pool.query<PointProduct>(
    `SELECT i.code, COALESCE(i.name_1, '') AS name,
            COALESCE(NULLIF(g.name_1, ''), NULLIF(i.group_main, ''), '-') AS group_name,
            COALESCE(b.name_1, '') AS brand,
            COALESCE(d.have_point, 0)::int AS have_point,
            COALESCE(i.balance_qty, 0)::text AS stockqty
       FROM ic_inventory i
       JOIN ic_inventory_detail d ON d.ic_code = i.code
       LEFT JOIN ic_group g ON g.code = i.group_main
       LEFT JOIN ic_brand b ON b.code = i.item_brand
      WHERE true ${b.sql}
      ORDER BY i.code
      LIMIT $1 OFFSET $2`,
    [limit, offset, ...b.params],
  );
  return rows;
}

export type ProductPointLogEntry = {
  id: string;
  ic_code: string;
  item_name: string;
  before_value: number | null;
  after_value: number;
  reason: string;
  changed_by_name: string;
  changed_at: string;
};

// The migration seeds one baseline row per product; those are noise here, so
// only real changes (a recorded before value) are listed.
export async function getProductPointLog(limit = 50): Promise<ProductPointLogEntry[]> {
  const { rows } = await pool.query<ProductPointLogEntry>(
    `SELECT l.id::text, l.ic_code, COALESCE(i.name_1, '') AS item_name,
            l.before_value, l.after_value, l.reason,
            COALESCE(e.fullname_lo, l.changed_by) AS changed_by_name,
            l.changed_at::text
       FROM odg_product_point_log l
       LEFT JOIN ic_inventory i ON i.code = l.ic_code
       LEFT JOIN odg_employee e ON e.employee_code = l.changed_by
      WHERE l.before_value IS NOT NULL
      ORDER BY l.changed_at DESC LIMIT $1`,
    [limit],
  );
  return rows;
}

// ===== ຄັງຂອງລາງວັນ =====
// Two separate catalogues: odg_pomotion_point is redeemed with member points
// and gated by tier, while odg_pomotion_colection_point_detail_used is redeemed
// with a campaign's own points. Both are joined to stock so a reward the member
// can pick but the warehouse cannot hand over shows up.

export type RewardStats = {
  member_live: number;
  member_out: number;
  campaign_live: number;
  campaign_out: number;
  members_with_tier: number;
  members_total: number;
};

export type TierGroup = { tier: string; members: number };

// Which customers can actually reach a tier-gated reward. odg_pomotion_point
// gates on card_type (Silver/Gold/Platinum) but no table assigns a tier to a
// customer — the closest thing is a free-text cust_group_2 on the member row.
export async function getTierReach(): Promise<TierGroup[]> {
  const { rows } = await pool.query<TierGroup>(
    `SELECT COALESCE(NULLIF(m.cust_group_2, ''), NULLIF(m.cust_group_1, ''), '(ບໍ່ລະບຸ)') AS tier,
            count(*)::int AS members
       FROM member_lineoa_info m
      GROUP BY 1 ORDER BY members DESC LIMIT 15`,
  );
  return rows;
}

export async function getRewardStats(): Promise<RewardStats> {
  const { rows } = await pool.query<RewardStats>(
    `SELECT
       (SELECT count(*) FROM odg_pomotion_point p
         WHERE CURRENT_DATE BETWEEN p.from_date::date AND p.to_date::date)::int AS member_live,
       (SELECT count(*) FROM odg_pomotion_point p
          LEFT JOIN ic_inventory i ON i.code = p.ic_code
         WHERE CURRENT_DATE BETWEEN p.from_date::date AND p.to_date::date
           AND COALESCE(i.balance_qty, 0) <= 0)::int AS member_out,
       (SELECT count(*) FROM odg_pomotion_colection c
          JOIN odg_pomotion_colection_point pc ON pc.pro_code = c.pro_code AND pc.is_active = 1
         WHERE CURRENT_DATE BETWEEN c.from_date AND c.to_date)::int AS campaign_live,
       (SELECT count(*) FROM odg_pomotion_colection c
          JOIN odg_pomotion_colection_point pc ON pc.pro_code = c.pro_code AND pc.is_active = 1
          LEFT JOIN ic_inventory i ON i.code = c.free_ic_code
         WHERE CURRENT_DATE BETWEEN c.from_date AND c.to_date
           AND COALESCE(i.balance_qty, 0) <= 0)::int AS campaign_out,
       (SELECT count(*) FROM member_lineoa_info
         WHERE cust_group_2 ILIKE '%gold%' OR cust_group_2 ILIKE '%platinum%'
            OR cust_group_2 ILIKE '%silver%')::int AS members_with_tier,
       (SELECT count(*) FROM member_lineoa_info)::int AS members_total`,
  );
  return rows[0];
}

export type MemberReward = {
  ic_code: string;
  item_name: string;
  tier: string;
  points: string;
  free_qty: string;
  from_date: string;
  to_date: string;
  live: boolean;
  stockqty: string;
};

// No redemption count here on purpose: RWRT rows in odg_member_point carry no
// item_code, so there is no way to tell which reward a member actually took.
// Matching on the point value alone would silently invent numbers.
export async function getMemberRewards(liveOnly: boolean): Promise<MemberReward[]> {
  const { rows } = await pool.query<MemberReward>(
    `SELECT p.ic_code, COALESCE(NULLIF(p.name_1, ''), i.name_1, '') AS item_name,
            COALESCE(l.name_1, p.card_type, '-') AS tier,
            p.point_promotion::text AS points,
            COALESCE(p.free_qty, 1)::text AS free_qty,
            p.from_date::date::text AS from_date,
            p.to_date::date::text AS to_date,
            (CURRENT_DATE BETWEEN p.from_date::date AND p.to_date::date) AS live,
            COALESCE(i.balance_qty, 0)::text AS stockqty
       FROM odg_pomotion_point p
       LEFT JOIN ic_inventory i ON i.code = p.ic_code
       LEFT JOIN odg_member_level l ON l.code = p.card_type
      WHERE ($1 = false OR CURRENT_DATE BETWEEN p.from_date::date AND p.to_date::date)
      ORDER BY (CURRENT_DATE BETWEEN p.from_date::date AND p.to_date::date) DESC,
               p.card_type, p.point_promotion`,
    [liveOnly],
  );
  return rows;
}

export type CampaignReward = {
  pro_code: string;
  pro_name: string;
  item_code: string;
  item_name: string;
  points: string;
  free_qty: string;
  from_date: string;
  to_date: string;
  live: boolean;
  is_show: number;
  stockqty: string;
  redeemed: number;
};

// The catalogue lives in odg_pomotion_colection: qty is the point cost and
// free_ic_code the goods handed over. Confirmed against real RWSO documents —
// for campaign 208 the ledger shows exactly 5→ເຕົາລີດ, 10→ເຕົາແມ່ເຫຼັກ,
// 30→ໄມໂຄເວັບ, 100→ຕູ້ເຢັນ, matching this table row for row.
// (odg_pomotion_colection_point_detail is the opposite side: what a customer
// must buy to earn those points.)
const CAMPAIGN_REWARD_LIVE = `COALESCE(pc.is_active, 0) = 1
                              AND CURRENT_DATE BETWEEN c.from_date AND c.to_date`;

export async function getCampaignRewards(liveOnly: boolean, limit: number, offset: number): Promise<CampaignReward[]> {
  const { rows } = await pool.query<CampaignReward>(
    `SELECT c.pro_code, COALESCE(pc.pro_name, '') AS pro_name,
            c.free_ic_code AS item_code, COALESCE(i.name_1, '') AS item_name,
            c.qty::text AS points,
            COALESCE(c.free_qty, 1)::text AS free_qty,
            c.from_date::text AS from_date, c.to_date::text AS to_date,
            (${CAMPAIGN_REWARD_LIVE}) AS live,
            COALESCE(c.is_show, 0)::int AS is_show,
            COALESCE(i.balance_qty, 0)::text AS stockqty,
            (SELECT count(*) FROM odg_pomotion_colection_transection t
              WHERE t.calc_flag = -1 AND t.pro_code = c.pro_code
                AND t.item_code = c.free_ic_code)::int AS redeemed
       FROM odg_pomotion_colection c
       LEFT JOIN odg_pomotion_colection_point pc ON pc.pro_code = c.pro_code
       LEFT JOIN ic_inventory i ON i.code = c.free_ic_code
      WHERE ($1 = false OR (${CAMPAIGN_REWARD_LIVE}))
      ORDER BY (${CAMPAIGN_REWARD_LIVE}) DESC, c.pro_code DESC, c.qty
      LIMIT $2 OFFSET $3`,
    [liveOnly, limit, offset],
  );
  return rows;
}

export async function countCampaignRewards(liveOnly: boolean): Promise<number> {
  const { rows } = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n
       FROM odg_pomotion_colection c
       LEFT JOIN odg_pomotion_colection_point pc ON pc.pro_code = c.pro_code
      WHERE ($1 = false OR (${CAMPAIGN_REWARD_LIVE}))`,
    [liveOnly],
  );
  return rows[0]?.n ?? 0;
}

// ===== ລະດັບສະມາຊິກ =====
// A customer's tier is the highest rule whose threshold their yearly points
// reach, unless a manual override exists for that year. Needs migration 005.

export async function isTierSchemaReady(): Promise<boolean> {
  const { rows } = await pool.query<{ ok: boolean }>(
    `SELECT (to_regclass('public.odg_member_tier_rule') IS NOT NULL
             AND to_regclass('public.odg_member_tier_override') IS NOT NULL) AS ok`,
  );
  return rows[0]?.ok ?? false;
}

export async function getLevels(): Promise<{ code: string; name: string }[]> {
  const { rows } = await pool.query<{ code: string; name: string }>(
    `SELECT code, COALESCE(name_1, code) AS name FROM odg_member_level ORDER BY code`,
  );
  return rows;
}

export type TierRule = {
  id: string;
  tier_code: string;
  tier_name: string;
  min_points: number;
  from_year: number;
  is_active: number;
  note: string;
  members: number;
  rewards: number;
};

// members = how many customers the threshold would place at this tier this
// year; rewards = how many catalogue items that tier can redeem. Shown together
// so a threshold that grants a tier nobody can spend at is obvious.
export async function getTierRules(year: number): Promise<TierRule[]> {
  const { rows } = await pool.query<TierRule>(
    `WITH bal AS (
       SELECT cust_code, sum(get_new_point * CASE WHEN calc_flag = -1 THEN -1 ELSE 1 END)::int AS pts
         FROM odg_member_point WHERE extract(year FROM doc_date) = $1 GROUP BY 1),
     assigned AS (
       SELECT b.cust_code,
              (SELECT r.tier_code FROM odg_member_tier_rule r
                WHERE r.is_active = 1 AND r.from_year <= $1 AND r.min_points <= b.pts
                ORDER BY r.min_points DESC LIMIT 1) AS tier_code
         FROM bal b)
     SELECT r.id::text, r.tier_code,
            COALESCE(l.name_1, r.tier_code) AS tier_name,
            r.min_points, r.from_year, r.is_active::int, r.note,
            (SELECT count(*) FROM assigned a WHERE a.tier_code = r.tier_code)::int AS members,
            (SELECT count(*) FROM odg_pomotion_point p
              WHERE p.card_type = r.tier_code
                AND CURRENT_DATE BETWEEN p.from_date::date AND p.to_date::date)::int AS rewards
       FROM odg_member_tier_rule r
       LEFT JOIN odg_member_level l ON l.code = r.tier_code
      WHERE r.from_year <= $1
      ORDER BY r.min_points`,
    [year],
  );
  return rows;
}

export type TierMember = {
  cust_code: string;
  cust_name: string;
  points: number;
  tier_code: string | null;
  tier_name: string;
  is_override: boolean;
  line_linked: boolean;
};

export async function getTierMembers(year: number, tier: string, limit: number, offset: number): Promise<TierMember[]> {
  const { rows } = await pool.query<TierMember>(
    `${TIER_RESOLVED("$1")}
     SELECT t.cust_code, COALESCE(m.name_1, '') AS cust_name, t.pts AS points,
            t.tier_code, COALESCE(l.name_1, '(ບໍ່ຮອດເກນ)') AS tier_name,
            t.is_override, (m.line_id IS NOT NULL AND m.line_id <> '') AS line_linked
       FROM resolved t
       LEFT JOIN member_lineoa_info m ON m.code = t.cust_code
       LEFT JOIN odg_member_level l ON l.code = t.tier_code
      WHERE ($2 = '' OR COALESCE(t.tier_code, '') = $2)
      ORDER BY t.pts DESC
      LIMIT $3 OFFSET $4`,
    [year, tier, limit, offset],
  );
  return rows;
}

export async function countTierMembers(year: number, tier: string): Promise<number> {
  const { rows } = await pool.query<{ n: number }>(
    `${TIER_RESOLVED("$1")}
     SELECT count(*)::int AS n FROM resolved t
      WHERE ($2 = '' OR COALESCE(t.tier_code, '') = $2)`,
    [year, tier],
  );
  return rows[0]?.n ?? 0;
}

// Shared CTE: yearly balance, then rule-derived tier with a manual override
// taking precedence.
function TIER_RESOLVED(yearParam: string): string {
  return `WITH bal AS (
       SELECT cust_code, sum(get_new_point * CASE WHEN calc_flag = -1 THEN -1 ELSE 1 END)::int AS pts
         FROM odg_member_point WHERE extract(year FROM doc_date) = ${yearParam} GROUP BY 1),
     resolved AS (
       SELECT b.cust_code, b.pts,
              COALESCE(o.tier_code,
                (SELECT r.tier_code FROM odg_member_tier_rule r
                  WHERE r.is_active = 1 AND r.from_year <= ${yearParam} AND r.min_points <= b.pts
                  ORDER BY r.min_points DESC LIMIT 1)) AS tier_code,
              (o.tier_code IS NOT NULL) AS is_override
         FROM bal b
         LEFT JOIN odg_member_tier_override o
           ON o.cust_code = b.cust_code AND o.year = ${yearParam})`;
}

// ===== ບິນທີ່ຍັງລໍຄິດແຕ້ມ =====
// Sales that have no row in odg_member_point at all — distinct from the "missed"
// report, where a row exists but awarded zero. Only member customers are
// counted; a walk-in with no member code is never meant to earn points.

export type PendingPointStats = {
  pending_docs: number;
  member_docs: number;
  non_member_docs: number;
  oldest: string | null;
  newest: string | null;
};

const PENDING_DOCS = `
  SELECT DISTINCT s.doc_no, s.customer_code, s.doc_date
    FROM odg_sale_detail s
   WHERE s.doc_date >= make_date($1, 1, 1) AND s.doc_date < make_date($1 + 1, 1, 1)
     AND s.doc_no LIKE 'CAK%'
     AND NOT EXISTS (SELECT 1 FROM odg_member_point p WHERE p.doc_no = s.doc_no)`;

export async function getPendingPointStats(year: number): Promise<PendingPointStats> {
  const { rows } = await pool.query<PendingPointStats>(
    `WITH d AS (${PENDING_DOCS})
     SELECT count(*)::int AS pending_docs,
            count(*) FILTER (WHERE EXISTS (SELECT 1 FROM member_lineoa_info m WHERE m.code = d.customer_code))::int AS member_docs,
            count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM member_lineoa_info m WHERE m.code = d.customer_code))::int AS non_member_docs,
            min(d.doc_date)::text AS oldest, max(d.doc_date)::text AS newest
       FROM d`,
    [year],
  );
  return rows[0];
}

export type PendingPointDoc = {
  doc_no: string;
  doc_date: string;
  cust_code: string;
  cust_name: string;
  cust_group: string;
  amount: string;
  days_waiting: number;
};

// Members only — those are the ones actually owed a calculation.
export async function getPendingPointDocs(year: number, limit: number, offset: number): Promise<PendingPointDoc[]> {
  const { rows } = await pool.query<PendingPointDoc>(
    `WITH d AS (${PENDING_DOCS})
     SELECT d.doc_no, d.doc_date::text AS doc_date, d.customer_code AS cust_code,
            COALESCE(m.name_1, '') AS cust_name,
            COALESCE(NULLIF(m.cust_group_2, ''), NULLIF(m.cust_group_1, ''), '-') AS cust_group,
            COALESCE(round((SELECT sum(s2.sum_amount / NULLIF(s2.exchange_rate, 0))
                              FROM odg_sale_detail s2 WHERE s2.doc_no = d.doc_no)), 0)::text AS amount,
            (CURRENT_DATE - d.doc_date)::int AS days_waiting
       FROM d
       JOIN member_lineoa_info m ON m.code = d.customer_code
      ORDER BY d.doc_date DESC
      LIMIT $2 OFFSET $3`,
    [year, limit, offset],
  );
  return rows;
}

// ===== ເງື່ອນໄຂຂອງແຕ່ລະໂປຣ =====
// Earning is described in up to three places depending on the campaign's
// product_detail_type: a flat per-item list (ITEM), a set/reference list
// (MULTIPLE), and bill-level tiers (is_condition = 1). Redemption terms all sit
// on odg_pomotion_colection.

export type EarnCondition = {
  kind: string;
  item_code: string;
  item_name: string;
  ref_item_code: string | null;
  ref_item_name: string;
  points: string;
  unit_code: string;
  cust_group: string;
  from_date: string;
  to_date: string;
  duration_day: string | null;
};

export async function getEarnConditions(proCode: string): Promise<EarnCondition[]> {
  const { rows } = await pool.query<EarnCondition>(
    // The UNION is wrapped so the ordering can cast points to numeric —
    // Postgres rejects an expression over an ordinal directly on a UNION.
    `SELECT * FROM (
     SELECT 'ຕໍ່ສິນຄ້າ' AS kind, d.item_code, COALESCE(i.name_1, '') AS item_name,
            NULL::varchar AS ref_item_code, '' AS ref_item_name,
            d.get_point::text AS points, COALESCE(d.unit_code, '') AS unit_code,
            COALESCE(d.cust_group, '') AS cust_group,
            d.from_date::text AS from_date, d.to_date::text AS to_date,
            NULL::text AS duration_day
       FROM odg_pomotion_colection_point_detail d
       LEFT JOIN ic_inventory i ON i.code = d.item_code
      WHERE d.pro_code = $1
     UNION ALL
     SELECT 'ແບບຊຸດ', m.item_code, COALESCE(i2.name_1, ''),
            m.ref_item_code, COALESCE(r.name_1, ''),
            m.get_point::text, COALESCE(m.unit_cost, ''),
            COALESCE(m.cust_group, ''),
            m.from_date::text, m.to_date::text, NULL
       FROM odg_pomotion_colection_point_detail_used_multi m
       LEFT JOIN ic_inventory i2 ON i2.code = m.item_code
       LEFT JOIN ic_inventory r ON r.code = m.ref_item_code
      WHERE m.pro_code = $1
     ) c ORDER BY c.kind, c.points::numeric, c.item_code`,
    [proCode],
  );
  return rows;
}

export type BillCondition = {
  qty: string;
  discount: string;
  points: string;
  is_bill: number;
  items: string;
};

// "Buy N units across the listed items → earn M points", usually tiered.
export async function getBillConditions(proCode: string): Promise<BillCondition[]> {
  const { rows } = await pool.query<BillCondition>(
    `SELECT c.qty::text, COALESCE(c.discount, 0)::text AS discount,
            COALESCE(c.get_point, 0)::text AS points,
            COALESCE(c.is_bill, 0)::int AS is_bill,
            COALESCE((SELECT string_agg(DISTINCT cd.item_code, ', ')
                        FROM odg_pomotion_colection_condition_detail cd
                       WHERE cd.pro_code = c.pro_code), '') AS items
       FROM odg_pomotion_colection_condition c
      WHERE c.pro_code = $1
      ORDER BY c.qty DESC`,
    [proCode],
  );
  return rows;
}

export type RedeemCondition = {
  item_code: string;
  item_name: string;
  points: string;
  free_qty: string;
  available_qty: string | null;
  is_per_cust: number;
  redeem_price: string;
  is_show: number;
  from_date: string;
  to_date: string;
  stockqty: string;
  redeemed: number;
};

export async function getRedeemConditions(proCode: string): Promise<RedeemCondition[]> {
  const { rows } = await pool.query<RedeemCondition>(
    `SELECT c.free_ic_code AS item_code, COALESCE(i.name_1, '') AS item_name,
            c.qty::text AS points, COALESCE(c.free_qty, 1)::text AS free_qty,
            c.available_qty::text, COALESCE(c.is_per_cust, 0)::int AS is_per_cust,
            COALESCE(c.redeem_price, 0)::text AS redeem_price,
            COALESCE(c.is_show, 0)::int AS is_show,
            c.from_date::text, c.to_date::text,
            COALESCE(i.balance_qty, 0)::text AS stockqty,
            (SELECT count(*) FROM odg_pomotion_colection_transection t
              WHERE t.calc_flag = -1 AND t.pro_code = c.pro_code
                AND t.item_code = c.free_ic_code)::int AS redeemed
       FROM odg_pomotion_colection c
       LEFT JOIN ic_inventory i ON i.code = c.free_ic_code
      WHERE c.pro_code = $1
      ORDER BY c.qty`,
    [proCode],
  );
  return rows;
}

export type CampaignDetailHead = {
  pro_code: string;
  pro_name: string;
  channel_name: string;
  product_detail_type: string;
  is_condition: number;
  is_redeem: number;
  is_active: number;
  from_date: string;
  to_date: string;
  start_exchange: string | null;
  end_exchange: string | null;
  rules: string;
  remark: string;
};

export async function getCampaignDetailHead(proCode: string): Promise<CampaignDetailHead | null> {
  const { rows } = await pool.query<CampaignDetailHead>(
    `SELECT p.pro_code, COALESCE(p.pro_name, '') AS pro_name,
            COALESCE(c.name_1, p.channel_group, '-') AS channel_name,
            COALESCE(p.product_detail_type, '') AS product_detail_type,
            COALESCE(p.is_condition, 0)::int AS is_condition,
            COALESCE(p.is_redeem, 0)::int AS is_redeem,
            COALESCE(p.is_active, 0)::int AS is_active,
            p.from_date::text, p.to_date::text,
            p.start_exchange::text, p.end_exchange::text,
            COALESCE(p.rules, '') AS rules, COALESCE(p.remark, '') AS remark
       FROM odg_pomotion_colection_point p
       LEFT JOIN pmt_channel_group c ON c.code = p.channel_group
      WHERE p.pro_code = $1`,
    [proCode],
  );
  return rows[0] ?? null;
}

// ===== ບິນທີ່ມີສິນຄ້າຮ່ວມລາຍການ ແຕ່ບໍ່ໄດ້ແຕ້ມ =====

export type MissedPointDoc = {
  doc_no: string;
  doc_date: string;
  cust_code: string;
  cust_name: string;
  total_amount: string;
  eligible_kip: string;
  expected_points: number;
};

export type MissedPointStats = { docs: number; eligible_kip: string; expected_points: number };

// odg_sale_detail keeps amounts in the document currency with exchange_rate
// stored as the inverse (0.00146 = THB per kip), so kip = sum_amount / rate.
const ELIGIBLE_KIP = `sum(s.sum_amount / NULLIF(s.exchange_rate, 0))
                        FILTER (WHERE COALESCE(d.have_point, 0) = 1)`;

export async function getMissedPointStats(year: number): Promise<MissedPointStats> {
  const { rows } = await pool.query<MissedPointStats>(
    `WITH doc AS (
       SELECT p.doc_no, p.point_amount, ${ELIGIBLE_KIP} AS eligible_kip
         FROM odg_member_point p
         JOIN odg_sale_detail s ON s.doc_no = p.doc_no
         LEFT JOIN ic_inventory_detail d ON d.ic_code = s.item_code
        WHERE p.calc_flag = 1 AND extract(year FROM p.doc_date) = $1
        GROUP BY 1, 2)
     SELECT count(*)::int AS docs,
            COALESCE(round(sum(eligible_kip)), 0)::text AS eligible_kip,
            COALESCE(floor(sum(eligible_kip) / 50000), 0)::int AS expected_points
       FROM doc WHERE point_amount = 0 AND eligible_kip > 0`,
    [year],
  );
  return rows[0];
}

export async function getMissedPointDocs(
  year: number,
  limit: number,
  offset: number,
): Promise<MissedPointDoc[]> {
  const { rows } = await pool.query<MissedPointDoc>(
    `WITH doc AS (
       SELECT p.doc_no, p.doc_date, p.cust_code, p.total_amount, p.point_amount,
              ${ELIGIBLE_KIP} AS eligible_kip
         FROM odg_member_point p
         JOIN odg_sale_detail s ON s.doc_no = p.doc_no
         LEFT JOIN ic_inventory_detail d ON d.ic_code = s.item_code
        WHERE p.calc_flag = 1 AND extract(year FROM p.doc_date) = $1
        GROUP BY 1, 2, 3, 4, 5)
     SELECT doc.doc_no, doc.doc_date::text AS doc_date, doc.cust_code,
            COALESCE(m.name_1, '') AS cust_name,
            doc.total_amount::text AS total_amount,
            round(doc.eligible_kip)::text AS eligible_kip,
            floor(doc.eligible_kip / 50000)::int AS expected_points
       FROM doc LEFT JOIN member_lineoa_info m ON m.code = doc.cust_code
      WHERE doc.point_amount = 0 AND doc.eligible_kip > 0
      ORDER BY doc.eligible_kip DESC
      LIMIT $2 OFFSET $3`,
    [year, limit, offset],
  );
  return rows;
}

// Campaign header fields the PMS is allowed to change. The rest of the row —
// and every odg_pomotion_colection_point_detail line — stays owned by the
// promotion system that created it.
export type CampaignHeader = {
  pro_code: string;
  pro_name: string;
  channel_group: string;
  from_date: string;
  to_date: string;
  start_exchange: string | null;
  end_exchange: string | null;
  is_active: number;
  is_redeem: number;
};

export async function getCampaignHeader(proCode: string): Promise<CampaignHeader | null> {
  const { rows } = await pool.query<CampaignHeader>(
    `SELECT pro_code, COALESCE(pro_name, '') AS pro_name,
            COALESCE(channel_group, '') AS channel_group,
            from_date::text, to_date::text,
            start_exchange::text, end_exchange::text,
            COALESCE(is_active, 0)::int AS is_active,
            COALESCE(is_redeem, 0)::int AS is_redeem
       FROM odg_pomotion_colection_point WHERE pro_code = $1`,
    [proCode],
  );
  return rows[0] ?? null;
}
