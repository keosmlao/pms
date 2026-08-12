import { pool } from "@/lib/db";

// Kip spent per 1 point. The POS/AR pipeline that writes odg_member_point uses
// 50,000 — every earning row in the ledger matches floor(point_amount / 50000).
// Note app_loyalty_config (the newer, still-disabled app) stores 70,000, so the
// two systems disagree; getConfigMismatch() surfaces that on the report.
export const KIP_PER_POINT = 50000;

// Rows fetched per request for the long tables. Small enough that a page is a
// quick query and a light HTML payload; the counts live in the tiles above.
export const PAGE_SIZE = 50;

export type Paged<T> = { rows: T[]; total: number; page: number; pages: number };

function pageBounds(page: number): { offset: number; page: number } {
  const p = Number.isFinite(page) && page > 1 ? Math.floor(page) : 1;
  return { offset: (p - 1) * PAGE_SIZE, page: p };
}

// calc_flag = 1 earns points, -1 removes them (CNK returns, RWRT redemptions).
const DELTA = `get_new_point * CASE WHEN calc_flag = -1 THEN -1 ELSE 1 END`;

// app_employee_channel stores pmt_channel_group codes; odg_sale_detail stores a
// denormalised Lao channel_name. Mapped explicitly rather than by fuzzy match so
// a renamed channel fails loudly instead of silently widening someone's scope.
// 109 (ຂາຍອອນລາຍ) is deliberately absent: odg_sale_detail has no online
// channel_name — those sales land in the catch-all 'ອື່ນໆ', which would drag
// unrelated documents into scope. Assigning someone channel 109 therefore
// scopes nothing, and ScopeBanner says so rather than failing silently.
const CHANNEL_CODE_TO_SALE_NAME: Record<string, string> = {
  "101": "ຂາຍໜ້າຮ້ານ",
  "102": "ຂາຍສົ່ງ",
  "103": "ຂາຍໂຄງການ",
  "104": "ບໍລິການ",
  "10202": "ຂາຍຊ່າງ",
};

export type UserScope = {
  employeeCode: string;
  buCodes: string[];
  channelCodes: string[];
  channelNames: string[];
  groups: { group_main: string; group_sub: string }[];
  isScoped: boolean;
};

// What one employee is responsible for. An employee with no rows in any of the
// three tables is unscoped and sees everything; anyone with at least one row is
// limited to the union of what those rows cover.
export async function getUserScope(employeeCode: string): Promise<UserScope> {
  const [bu, ch, gr] = await Promise.all([
    pool.query<{ bu_code: string }>(
      `SELECT DISTINCT bu_code FROM app_employee_bu WHERE emp_code = $1 AND bu_code <> ''`,
      [employeeCode],
    ),
    pool.query<{ channel_code: string }>(
      `SELECT DISTINCT channel_code FROM app_employee_channel WHERE emp_code = $1 AND channel_code <> ''`,
      [employeeCode],
    ),
    pool.query<{ group_main: string; group_sub: string }>(
      `SELECT DISTINCT group_main, COALESCE(group_sub, '') AS group_sub
         FROM odg_group_responsible WHERE employee_code = $1`,
      [employeeCode],
    ),
  ]);

  const buCodes = bu.rows.map((r) => r.bu_code);
  const channelCodes = ch.rows.map((r) => r.channel_code);
  const channelNames = channelCodes
    .map((c) => CHANNEL_CODE_TO_SALE_NAME[c])
    .filter((n): n is string => Boolean(n));

  return {
    employeeCode,
    buCodes,
    channelCodes,
    channelNames,
    groups: gr.rows,
    isScoped: buCodes.length + channelCodes.length + gr.rows.length > 0,
  };
}

// SQL restricting a ledger table to documents the scope covers, matched through
// odg_sale_detail. `docAlias` is the alias holding doc_no. Params are appended
// starting at `startIndex`; an unscoped user gets an empty fragment.
function scopeClause(
  scope: UserScope,
  docAlias: string,
  startIndex: number,
): { sql: string; params: unknown[] } {
  if (!scope.isScoped) return { sql: "", params: [] };

  const conds: string[] = [];
  const params: unknown[] = [];
  let i = startIndex;

  if (scope.buCodes.length) {
    conds.push(`sd.bu_code = ANY($${i}::varchar[])`);
    params.push(scope.buCodes);
    i++;
  }
  if (scope.channelNames.length) {
    conds.push(`sd.channel_name = ANY($${i}::varchar[])`);
    params.push(scope.channelNames);
    i++;
  }
  if (scope.groups.length) {
    // group_sub = '' on the responsibility row means the whole main group.
    conds.push(`EXISTS (SELECT 1 FROM odg_group_responsible gr
                         WHERE gr.group_main = sd.group_main
                           AND (gr.group_sub = '' OR gr.group_sub = sd.group_sub)
                           AND gr.employee_code = $${i})`);
    params.push(scope.employeeCode);
    i++;
  }

  // No usable dimension (e.g. only channel codes that map to nothing) — deny
  // rather than fall through to unrestricted.
  if (!conds.length) return { sql: "AND false", params: [] };

  return {
    sql: `AND EXISTS (SELECT 1 FROM odg_sale_detail sd
                       WHERE sd.doc_no = ${docAlias}.doc_no AND (${conds.join(" OR ")}))`,
    params,
  };
}

export type LoyaltySummary = {
  docs: number;
  customers: number;
  earned: number;
  reversed: number;
  redeemed: number;
  extra: number;
  outstanding: number;
  zero_point_docs: number;
  last_doc_date: string | null;
  last_synced_at: string | null;
};

// Headline numbers for one earning year. RWRT = reward redemption, CNK/other
// negatives = reversals, ETF/ET = promotional bonus points.
export async function getLoyaltySummary(year: number, scope: UserScope): Promise<LoyaltySummary> {
  const sc = scopeClause(scope, "odg_member_point", 2);
  const { rows } = await pool.query<LoyaltySummary>(
    `SELECT count(*)::int AS docs,
            count(DISTINCT cust_code)::int AS customers,
            COALESCE(sum(get_new_point) FILTER (WHERE calc_flag = 1), 0)::int AS earned,
            COALESCE(sum(get_new_point) FILTER (WHERE calc_flag = -1 AND doc_no NOT LIKE 'RWRT%'), 0)::int AS reversed,
            COALESCE(sum(get_new_point) FILTER (WHERE doc_no LIKE 'RWRT%'), 0)::int AS redeemed,
            COALESCE(sum(get_new_point) FILTER (WHERE calc_flag = 1 AND doc_no LIKE 'ET%'), 0)::int AS extra,
            COALESCE(sum(${DELTA}), 0)::int AS outstanding,
            count(*) FILTER (WHERE calc_flag = 1 AND total_amount > 0 AND point_amount = 0)::int AS zero_point_docs,
            max(doc_date)::text AS last_doc_date,
            max(create_date_time_now)::text AS last_synced_at
       FROM odg_member_point
      WHERE extract(year FROM doc_date) = $1 ${sc.sql}`,
    [year, ...sc.params],
  );
  return rows[0];
}

export async function getLedgerYears(): Promise<number[]> {
  const { rows } = await pool.query<{ yr: number }>(
    `SELECT DISTINCT extract(year FROM doc_date)::int AS yr
       FROM odg_member_point ORDER BY yr DESC`,
  );
  return rows.map((r) => r.yr);
}

export type MonthlyPoints = {
  ym: string;
  docs: number;
  customers: number;
  earned: number;
  redeemed: number;
  reversed: number;
};

export async function getMonthlyPoints(scope: UserScope, months = 18): Promise<MonthlyPoints[]> {
  const sc = scopeClause(scope, "odg_member_point", 2);
  const { rows } = await pool.query<MonthlyPoints>(
    `SELECT to_char(doc_date, 'YYYY-MM') AS ym,
            count(*)::int AS docs,
            count(DISTINCT cust_code)::int AS customers,
            COALESCE(sum(get_new_point) FILTER (WHERE calc_flag = 1), 0)::int AS earned,
            COALESCE(sum(get_new_point) FILTER (WHERE doc_no LIKE 'RWRT%'), 0)::int AS redeemed,
            COALESCE(sum(get_new_point) FILTER (WHERE calc_flag = -1 AND doc_no NOT LIKE 'RWRT%'), 0)::int AS reversed
       FROM odg_member_point
      WHERE true ${sc.sql}
      GROUP BY 1 ORDER BY 1 DESC LIMIT $1`,
    [months, ...sc.params],
  );
  return rows.reverse();
}

export type NegativeBalance = {
  yr: number;
  cust_code: string;
  name: string;
  line_id: string | null;
  balance: number;
  earned: number;
  burned: number;
};

// Customers left with a negative closing balance for an earning year — points
// were taken that were never granted. Deliberately computed from the year total
// rather than a running balance: sales are backfilled into the ledger days
// after the redemption rows, so any row-order walk shows dips that never
// happened in real life.
export async function getNegativeBalances(scope: UserScope, limit = 200): Promise<NegativeBalance[]> {
  const sc = scopeClause(scope, "p", 2);
  const { rows } = await pool.query<NegativeBalance>(
    `WITH b AS (
       SELECT p.cust_code, extract(year FROM p.doc_date)::int AS yr,
              sum(${DELTA})::int AS balance,
              COALESCE(sum(p.get_new_point) FILTER (WHERE p.calc_flag = 1), 0)::int AS earned,
              COALESCE(sum(p.get_new_point) FILTER (WHERE p.calc_flag = -1), 0)::int AS burned
         FROM odg_member_point p
        WHERE true ${sc.sql}
        GROUP BY 1, 2
        HAVING sum(${DELTA}) < 0)
     SELECT b.yr, b.cust_code, COALESCE(m.name_1, '') AS name, m.line_id,
            b.balance, b.earned, b.burned
       FROM b LEFT JOIN member_lineoa_info m ON m.code = b.cust_code
      ORDER BY b.balance ASC LIMIT $1`,
    [limit, ...sc.params],
  );
  return rows;
}

export type WrongDeduction = {
  doc_no: string;
  doc_date: string;
  cust_code: string;
  name: string;
  total_amount: string;
  points_taken: number;
  sale_docs: string;
};

// Returns (CNK) that deducted points even though the matching sale awarded
// none. There is no ref_doc on CNK rows, so the original sale is matched on
// (cust_code, total_amount) — treat the list as candidates to confirm.
export async function getWrongDeductions(scope: UserScope, limit = 200): Promise<WrongDeduction[]> {
  const sc = scopeClause(scope, "cn", 2);
  const { rows } = await pool.query<WrongDeduction>(
    `SELECT cn.doc_no, cn.doc_date::text AS doc_date, cn.cust_code,
            COALESCE(m.name_1, '') AS name,
            cn.total_amount::text AS total_amount,
            cn.get_new_point::int AS points_taken,
            (SELECT string_agg(s.doc_no, ', ' ORDER BY s.doc_date)
               FROM odg_member_point s
              WHERE s.cust_code = cn.cust_code AND s.calc_flag = 1
                AND s.total_amount = cn.total_amount AND s.point_amount = 0) AS sale_docs
       FROM odg_member_point cn
       LEFT JOIN member_lineoa_info m ON m.code = cn.cust_code
      WHERE cn.doc_no LIKE 'CNK%' AND cn.calc_flag = -1 AND cn.get_new_point > 0
        AND EXISTS (SELECT 1 FROM odg_member_point s
                     WHERE s.cust_code = cn.cust_code AND s.calc_flag = 1
                       AND s.total_amount = cn.total_amount AND s.point_amount = 0)
        ${sc.sql}
      ORDER BY cn.doc_date DESC LIMIT $1`,
    [limit, ...sc.params],
  );
  return rows;
}

export type UnderAward = {
  doc_no: string;
  doc_date: string;
  cust_code: string;
  point_amount: string;
  awarded: number;
  expected: number;
  shortfall: number;
};

// Sales that granted fewer points than the doc-level rate implies. The gap is
// consistently 1-3 points, which is what per-line rounding produces.
export async function getUnderAwarded(
  scope: UserScope,
  page = 1,
  total = 0,
): Promise<Paged<UnderAward>> {
  const { offset, page: p } = pageBounds(page);
  const sc = scopeClause(scope, "p", 4);
  const { rows } = await pool.query<UnderAward>(
    `SELECT p.doc_no, p.doc_date::text AS doc_date, p.cust_code,
            p.point_amount::text AS point_amount,
            p.get_new_point::int AS awarded,
            floor(p.point_amount / $1)::int AS expected,
            (floor(p.point_amount / $1) - p.get_new_point)::int AS shortfall
       FROM odg_member_point p
      WHERE p.calc_flag = 1 AND p.point_amount > 0
        AND p.get_new_point < floor(p.point_amount / $1) ${sc.sql}
      ORDER BY p.doc_date DESC, p.roworder DESC
      LIMIT $2 OFFSET $3`,
    [KIP_PER_POINT, PAGE_SIZE, offset, ...sc.params],
  );
  return { rows, total, page: p, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export type UnderAwardStats = { docs: number; affected: number; points_lost: number };

export async function getUnderAwardStats(scope: UserScope): Promise<UnderAwardStats> {
  const sc = scopeClause(scope, "p", 2);
  const { rows } = await pool.query<UnderAwardStats>(
    `SELECT count(*)::int AS docs,
            count(*) FILTER (WHERE p.get_new_point < floor(p.point_amount / $1))::int AS affected,
            COALESCE(sum(floor(p.point_amount / $1) - p.get_new_point)
                     FILTER (WHERE p.get_new_point < floor(p.point_amount / $1)), 0)::int AS points_lost
       FROM odg_member_point p
      WHERE p.calc_flag = 1 AND p.point_amount > 0 ${sc.sql}`,
    [KIP_PER_POINT, ...sc.params],
  );
  return rows[0];
}

export type DuplicateLink = {
  line_id: string;
  customers: number;
  cust_codes: string;
  names: string;
  total_points: number;
};

// One LINE account mapped to several customer codes (usually the same phone
// number stored in different formats). Points land on whichever code the sale
// used, so the member only ever sees part of their balance.
export async function getDuplicateLinks(scope: UserScope): Promise<DuplicateLink[]> {
  const sc = scopeClause(scope, "p", 1);
  const { rows } = await pool.query<DuplicateLink>(
    `WITH dup AS (
       SELECT line_id FROM member_lineoa_info
        WHERE line_id IS NOT NULL AND line_id <> ''
        GROUP BY line_id HAVING count(*) > 1),
     pts AS (
       SELECT p.cust_code, sum(${DELTA})::int AS pts
         FROM odg_member_point p WHERE true ${sc.sql} GROUP BY p.cust_code)
     SELECT m.line_id,
            count(*)::int AS customers,
            string_agg(m.code, ', ' ORDER BY m.code) AS cust_codes,
            string_agg(COALESCE(m.name_1, ''), ' / ' ORDER BY m.code) AS names,
            COALESCE(sum(p.pts), 0)::int AS total_points
       FROM member_lineoa_info m
       JOIN dup d ON d.line_id = m.line_id
       LEFT JOIN pts p ON p.cust_code = m.code
      GROUP BY m.line_id ORDER BY total_points DESC`,
    sc.params,
  );
  return rows;
}

export type LinkageStats = {
  members: number;
  linked: number;
  earners: number;
  earners_linked: number;
  unreachable_points: number;
};

// How much of the point-earning base can actually see their balance in LINE OA.
export async function getLinkageStats(year: number, scope: UserScope): Promise<LinkageStats> {
  const sc = scopeClause(scope, "p", 2);
  const { rows } = await pool.query<LinkageStats>(
    `WITH e AS (
       SELECT p.cust_code, sum(${DELTA})::int AS pts
         FROM odg_member_point p
        WHERE extract(year FROM p.doc_date) = $1 ${sc.sql}
        GROUP BY p.cust_code)
     SELECT (SELECT count(*) FROM member_lineoa_info)::int AS members,
            (SELECT count(*) FROM member_lineoa_info
              WHERE line_id IS NOT NULL AND line_id <> '')::int AS linked,
            count(*)::int AS earners,
            count(*) FILTER (WHERE m.line_id IS NOT NULL AND m.line_id <> '')::int AS earners_linked,
            COALESCE(sum(e.pts) FILTER (WHERE m.line_id IS NULL OR m.line_id = ''), 0)::int AS unreachable_points
       FROM e LEFT JOIN member_lineoa_info m ON m.code = e.cust_code`,
    [year, ...sc.params],
  );
  return rows[0];
}

// ===== ແຍກ BU × ຊ່ອງທາງ (member points) =====

export type BuChannelRow = {
  bu_code: string;
  bu_name: string;
  channel_name: string;
  docs: number;
  customers: number;
  earned: number;
  redeemed: number;
  outstanding: number;
};

// Member points split by selling BU and sales channel. Both come from
// odg_sale_detail — odg_member_point itself carries no such column. A document
// with lines in more than one BU is counted once per BU it touches.
//
// Documents with no sale line are labelled by why they have none rather than
// pooled into one "unknown" row: ETF bonus grants and RWRT redemptions are not
// sales at all, whereas an unmatched CAK/INK/POS really is a sale that
// odg_sale_detail has not received yet (it typically trails by a day).
export async function getPointsByBuChannel(
  year: number,
  scope: UserScope,
): Promise<BuChannelRow[]> {
  const sc = scopeClause(scope, "p", 2);
  const { rows } = await pool.query<BuChannelRow>(
    `WITH pts AS (
       SELECT p.doc_no, p.cust_code, p.get_new_point, p.calc_flag
         FROM odg_member_point p
        WHERE extract(year FROM p.doc_date) = $1 ${sc.sql}),
     -- Narrowed to the year's documents before DISTINCT. Taking DISTINCT over
     -- all of odg_sale_detail first cost ~8s; the IN list lets it use the
     -- doc_no index and drops it to ~0.2s.
     doc_dim AS (
       SELECT DISTINCT s.doc_no, s.bu_code, COALESCE(s.bu_name, '') AS bu_name,
              COALESCE(s.channel_name, '') AS channel_name
         FROM odg_sale_detail s
        WHERE s.bu_code IS NOT NULL
          AND s.doc_no IN (SELECT doc_no FROM pts))
     SELECT COALESCE(d.bu_code, '—') AS bu_code,
            COALESCE(NULLIF(d.bu_name, ''),
              CASE WHEN p.doc_no LIKE 'ET%'   THEN 'ແຕ້ມແຖມ (ບໍ່ແມ່ນບິນຂາຍ)'
                   WHEN p.doc_no LIKE 'RWRT%' THEN 'ໃບແລກລາງວັນ (ບໍ່ແມ່ນບິນຂາຍ)'
                   ELSE 'ບິນຂາຍທີ່ຍັງບໍ່ທັນ sync' END) AS bu_name,
            COALESCE(NULLIF(d.channel_name, ''), '—') AS channel_name,
            count(DISTINCT p.doc_no)::int AS docs,
            count(DISTINCT p.cust_code)::int AS customers,
            COALESCE(sum(p.get_new_point) FILTER (WHERE p.calc_flag = 1), 0)::int AS earned,
            COALESCE(sum(p.get_new_point) FILTER (WHERE p.calc_flag = -1), 0)::int AS redeemed,
            COALESCE(sum(p.get_new_point * CASE WHEN p.calc_flag = -1 THEN -1 ELSE 1 END), 0)::int AS outstanding
       FROM pts p LEFT JOIN doc_dim d ON d.doc_no = p.doc_no
      GROUP BY 1, 2, 3 ORDER BY earned DESC`,
    [year, ...sc.params],
  );
  return rows;
}

// ===== ໂປຣໂມຊັ່ນສະສົມແຕ້ມ (odg_pomotion_colection_point) =====
// A separate programme from the member points above: buying listed items earns
// campaign points, redeemable for goods during the exchange window. Its ledger
// is odg_pomotion_colection_transection (calc_flag 1 = earn, -1 = RWSO redeem).

// Campaigns carry a pmt_channel_group code, the same vocabulary as
// app_employee_channel, so channel scoping applies directly. They carry no BU,
// so someone scoped by BU alone still sees every campaign — stated on the page.
function campaignChannelClause(
  scope: UserScope,
  alias: string,
  startIndex: number,
): { sql: string; params: unknown[] } {
  if (!scope.isScoped || !scope.channelCodes.length) return { sql: "", params: [] };
  return {
    sql: `AND ${alias}.channel_group = ANY($${startIndex}::varchar[])`,
    params: [scope.channelCodes],
  };
}

// Same restriction expressed for the campaign transaction/balance tables, which
// reach the channel only through their pro_code.
function campaignTxClause(
  scope: UserScope,
  alias: string,
  startIndex: number,
): { sql: string; params: unknown[] } {
  if (!scope.isScoped || !scope.channelCodes.length) return { sql: "", params: [] };
  return {
    sql: `AND ${alias}.pro_code IN (SELECT pro_code FROM odg_pomotion_colection_point
                                     WHERE channel_group = ANY($${startIndex}::varchar[]))`,
    params: [scope.channelCodes],
  };
}

export type Campaign = {
  pro_code: string;
  pro_name: string;
  from_date: string;
  to_date: string;
  start_exchange: string | null;
  end_exchange: string | null;
  channel_group: string;
  channel_name: string;
  is_redeem: number;
  is_active: number;
  customers: number;
  earned: string;
  redeemed: string;
  balance: string;
};

export async function getCampaignCount(scope: UserScope): Promise<number> {
  const cc = campaignChannelClause(scope, "p", 1);
  const { rows } = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM odg_pomotion_colection_point p WHERE true ${cc.sql}`,
    cc.params,
  );
  return rows[0]?.n ?? 0;
}

export async function getCampaigns(
  scope: UserScope,
  page = 1,
  total = 0,
): Promise<Paged<Campaign>> {
  const { offset, page: p } = pageBounds(page);
  const cc = campaignChannelClause(scope, "p", 3);
  const { rows } = await pool.query<Campaign>(
    `WITH tx AS (
       SELECT pro_code,
              sum(get_point) FILTER (WHERE calc_flag = 1) AS earned,
              sum(get_point) FILTER (WHERE calc_flag = -1) AS redeemed,
              count(DISTINCT cust_code) AS customers
         FROM odg_pomotion_colection_transection GROUP BY pro_code)
     SELECT p.pro_code, COALESCE(p.pro_name, '') AS pro_name,
            p.from_date::text AS from_date, p.to_date::text AS to_date,
            p.start_exchange::text AS start_exchange, p.end_exchange::text AS end_exchange,
            COALESCE(p.channel_group, '') AS channel_group,
            COALESCE(c.name_1, p.channel_group, '-') AS channel_name,
            COALESCE(p.is_redeem, 0)::int AS is_redeem,
            COALESCE(p.is_active, 0)::int AS is_active,
            COALESCE(tx.customers, 0)::int AS customers,
            COALESCE(tx.earned, 0)::text AS earned,
            COALESCE(tx.redeemed, 0)::text AS redeemed,
            (COALESCE(tx.earned, 0) - COALESCE(tx.redeemed, 0))::text AS balance
       FROM odg_pomotion_colection_point p
       LEFT JOIN pmt_channel_group c ON c.code = p.channel_group
       LEFT JOIN tx ON tx.pro_code = p.pro_code
      WHERE true ${cc.sql}
      ORDER BY p.from_date DESC, p.pro_code DESC
      LIMIT $1 OFFSET $2`,
    [PAGE_SIZE, offset, ...cc.params],
  );
  return { rows, total, page: p, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export type CampaignSummary = {
  campaigns: number;
  active: number;
  redeemable: number;
  customers: number;
  earned: string;
  redeemed: string;
  outstanding: string;
  last_activity: string | null;
};

export async function getCampaignSummary(scope: UserScope): Promise<CampaignSummary> {
  // Both fragments filter on the same channel list, so they share $1.
  const cc = campaignChannelClause(scope, "hp", 1);
  const tc = campaignTxClause(scope, "t", 1);
  const { rows } = await pool.query<CampaignSummary>(
    `SELECT (SELECT count(*) FROM odg_pomotion_colection_point hp WHERE true ${cc.sql})::int AS campaigns,
            (SELECT count(*) FROM odg_pomotion_colection_point hp WHERE hp.is_active = 1 ${cc.sql})::int AS active,
            (SELECT count(*) FROM odg_pomotion_colection_point hp WHERE hp.is_redeem = 1 ${cc.sql})::int AS redeemable,
            count(DISTINCT t.cust_code)::int AS customers,
            COALESCE(sum(t.get_point) FILTER (WHERE t.calc_flag = 1), 0)::text AS earned,
            COALESCE(sum(t.get_point) FILTER (WHERE t.calc_flag = -1), 0)::text AS redeemed,
            (COALESCE(sum(t.get_point) FILTER (WHERE t.calc_flag = 1), 0)
             - COALESCE(sum(t.get_point) FILTER (WHERE t.calc_flag = -1), 0))::text AS outstanding,
            max(t.doc_date)::text AS last_activity
       FROM odg_pomotion_colection_transection t
      WHERE true ${tc.sql}`,
    cc.params,
  );
  return rows[0];
}

export type Redemption = {
  doc_no: string;
  doc_date: string;
  cust_code: string;
  cust_name: string;
  item_code: string;
  item_name: string;
  points: string;
  qty: string;
  pro_code: string;
  pro_name: string;
  channel_name: string;
};

// RWSO documents — goods handed over in exchange for campaign points.
export async function getRedemptionCount(scope: UserScope): Promise<number> {
  const tc = campaignTxClause(scope, "t", 1);
  const { rows } = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM odg_pomotion_colection_transection t
      WHERE t.calc_flag = -1 ${tc.sql}`,
    tc.params,
  );
  return rows[0]?.n ?? 0;
}

export async function getRedemptions(
  scope: UserScope,
  page = 1,
  total = 0,
): Promise<Paged<Redemption>> {
  const { offset, page: p } = pageBounds(page);
  const tc = campaignTxClause(scope, "t", 3);
  const { rows } = await pool.query<Redemption>(
    `SELECT t.doc_no, t.doc_date::text AS doc_date, t.cust_code,
            COALESCE(m.name_1, '') AS cust_name,
            COALESCE(t.item_code, '') AS item_code,
            COALESCE(i.name_1, '') AS item_name,
            COALESCE(t.get_point, 0)::text AS points,
            COALESCE(t.qty, 0)::text AS qty,
            COALESCE(t.pro_code, '') AS pro_code,
            COALESCE(p.pro_name, '') AS pro_name,
            COALESCE(c.name_1, '-') AS channel_name
       FROM odg_pomotion_colection_transection t
       LEFT JOIN ic_inventory i ON i.code = t.item_code
       LEFT JOIN member_lineoa_info m ON m.code = t.cust_code
       LEFT JOIN odg_pomotion_colection_point p ON p.pro_code = t.pro_code
       LEFT JOIN pmt_channel_group c ON c.code = p.channel_group
      WHERE t.calc_flag = -1 ${tc.sql}
      ORDER BY t.doc_date DESC, t.roworder DESC
      LIMIT $1 OFFSET $2`,
    [PAGE_SIZE, offset, ...tc.params],
  );
  return { rows, total, page: p, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export type TopReward = {
  item_code: string;
  item_name: string;
  times: number;
  qty: string;
  points: string;
  customers: number;
};

export async function getTopRewards(scope: UserScope, limit = 40): Promise<TopReward[]> {
  const tc = campaignTxClause(scope, "t", 2);
  const { rows } = await pool.query<TopReward>(
    `SELECT COALESCE(t.item_code, '') AS item_code,
            COALESCE(i.name_1, '') AS item_name,
            count(*)::int AS times,
            COALESCE(sum(t.qty), 0)::text AS qty,
            COALESCE(sum(t.get_point), 0)::text AS points,
            count(DISTINCT t.cust_code)::int AS customers
       FROM odg_pomotion_colection_transection t
       LEFT JOIN ic_inventory i ON i.code = t.item_code
      WHERE t.calc_flag = -1 ${tc.sql}
      GROUP BY 1, 2 ORDER BY points DESC LIMIT $1`,
    [limit, ...tc.params],
  );
  return rows;
}

export type CampaignBalanceIssue = {
  cust_code: string;
  cust_name: string;
  pro_code: string;
  pro_name: string;
  stored: string;
  ledger: string;
  diff: string;
  kind: string;
};

// odg_pomotion_colection_total holds a stored balance per (customer, campaign).
// Anything that disagrees with the transaction ledger, or that sits below zero,
// is what the LINE OA app would show the member.
export async function getCampaignBalanceIssues(scope: UserScope, limit = 200): Promise<CampaignBalanceIssue[]> {
  const tc = campaignTxClause(scope, "t", 2);
  const { rows } = await pool.query<CampaignBalanceIssue>(
    `WITH tx AS (
       SELECT cust_code, pro_code,
              sum(get_point * CASE WHEN calc_flag = -1 THEN -1 ELSE 1 END) AS pts
         FROM odg_pomotion_colection_transection GROUP BY 1, 2)
     SELECT t.cust_code, COALESCE(m.name_1, '') AS cust_name,
            t.pro_code, COALESCE(p.pro_name, '') AS pro_name,
            t.total_point::text AS stored,
            COALESCE(x.pts, 0)::text AS ledger,
            (t.total_point - COALESCE(x.pts, 0))::text AS diff,
            CASE WHEN t.total_point < 0 THEN 'ຍອດຕິດລົບ'
                 WHEN x.pts IS NULL THEN 'ບໍ່ມີລາຍການໃນ ledger'
                 ELSE 'ຍອດບໍ່ກົງ ledger' END AS kind
       FROM odg_pomotion_colection_total t
       LEFT JOIN tx x ON x.cust_code = t.cust_code AND x.pro_code = t.pro_code
       LEFT JOIN member_lineoa_info m ON m.code = t.cust_code
       LEFT JOIN odg_pomotion_colection_point p ON p.pro_code = t.pro_code
      WHERE (t.total_point < 0 OR x.pts IS NULL OR t.total_point <> x.pts) ${tc.sql}
      ORDER BY abs(t.total_point - COALESCE(x.pts, 0)) DESC, t.total_point ASC LIMIT $1`,
    [limit, ...tc.params],
  );
  return rows;
}

export type ConfigRow = {
  id: string;
  earn_kip_per_point: string;
  point_name: string | null;
  enabled: boolean;
  is_active: boolean;
  updated_at: string | null;
};

// The newer app_loyalty_config table. Anything other than KIP_PER_POINT on an
// active row means the two engines would award different amounts.
export async function getLoyaltyConfig(): Promise<ConfigRow[]> {
  const { rows } = await pool.query<ConfigRow>(
    `SELECT id::text, earn_kip_per_point::text, point_name, enabled, is_active,
            updated_at::text
       FROM app_loyalty_config ORDER BY id`,
  );
  return rows;
}
