import { pool } from "@/lib/db";

// ໂຄງການສົ່ງເສີມການຂາຍ — unit-target tiered team bonuses ("ໃບຢັ້ງຢືນສົ່ງເສີມການຂາຍ").
//
// Actuals come from odg_sale_detail, the sales fact table refreshed daily.
// `qty` there already carries returns as negative rows, so a plain SUM is the
// net figure. Scope is the whole company by default; a campaign may restrict
// itself to a set of department_code or bu_code values instead.

export type ScopeKind = "all" | "department" | "bu";

export type CampaignTier = {
  id: number;
  pct: string;
  target_qty: string;
  bonus_amount: string;
};

export type CampaignLine = {
  id: number;
  name: string;
  categories: string[];
  brands: string[];
  unit_bonus_brands: string[];
  unit_bonus_per_unit: string;
  sort_order: number;
  tiers: CampaignTier[];
  // computed
  actual: number;
  target100: number;
  pct: number; // achievement against the 100% target
  achievedTier: CampaignTier | null;
  nextTier: CampaignTier | null;
  gapToNext: number;
  tierBonus: number;
  unitBonusQty: number;
  unitBonus: number;
  totalBonus: number;
};

export type Campaign = {
  id: number;
  name: string;
  description: string | null;
  date_from: string;
  date_to: string;
  scope_kind: ScopeKind;
  scope_codes: string[];
  reward_currency: string;
  status: string;
  note: string | null;
  created_by: string | null;
  exclude_gifts: boolean;
  /** ວິທີແບ່ງເງິນທີມໃຫ້ພະນັກງານ — prorata | equal | none */
  split_rule: string;
  /** ຫົວໜ້າທີມທີ່ຮັບຍອດຂອງຄົນທີ່ຈັບຄູ່ຊື່ບໍ່ໄດ້ */
  fallback_employee_code: string;
  /** ຊ່ອງທາງລູກຄ້າທີ່ນັບເຂົ້າ (ar_group) — ວ່າງ = ທຸກຊ່ອງທາງ */
  channel_codes: string[];
};

// ລະຫັດພະແນກ → ຊື່ ສຳລັບສະແດງຜົນ
export async function departmentNames(codes: string[]): Promise<Map<string, string>> {
  if (!codes.length) return new Map();
  const { rows } = await pool.query<{ code: string; name: string }>(
    `SELECT department_code AS code, MAX(department_name) AS name
       FROM odg_sale_detail
      WHERE department_code = ANY($1) AND doc_date >= CURRENT_DATE - 365
      GROUP BY 1`,
    [codes],
  );
  return new Map(rows.map((r) => [r.code, r.name || r.code]));
}

export async function scopeLabel(kind: ScopeKind, codes: string[]): Promise<string> {
  if (kind === "all" || !codes.length) return "ທຸກພະແນກ";
  const names = await departmentNames(codes);
  return codes.map((c) => names.get(c) ?? c).join(" · ");
}

export type CampaignWithLines = Campaign & {
  lines: CampaignLine[];
  totalBonus: number;
  daysTotal: number;
  daysElapsed: number;
};

type LineRow = {
  id: number;
  campaign_id: number;
  name: string;
  categories: string[];
  brands: string[];
  unit_bonus_brands: string[];
  unit_bonus_per_unit: string;
  sort_order: number;
};

// Scope predicate + the params it consumes, offset by the params already bound.
function scopeClause(kind: ScopeKind, codes: string[], nextParam: number) {
  if (kind === "department" && codes.length) {
    return { sql: `AND s.department_code = ANY($${nextParam})`, params: [codes] };
  }
  if (kind === "bu" && codes.length) {
    return { sql: `AND s.bu_code = ANY($${nextParam})`, params: [codes] };
  }
  return { sql: "", params: [] as unknown[] };
}

// "ຕົວທີ່ຂາຍຈິງ" — drop giveaways so a bonus is never earned on free units:
// price 0 (a real product handed out free) and the ຂອງແຖມ main group 98.
// Same rule the SALE app applies to odg_promo_campaign.
const GIFT_FILTER = `AND COALESCE(s.price, 0) > 0 AND COALESCE(TRIM(s.maingroup_code), '') <> '98'`;

function giftClause(excludeGifts: boolean): string {
  return excludeGifts ? GIFT_FILTER : "";
}

// ນັບສະເພາະຊ່ອງທາງທີ່ກຳນົດ — ໃນພະແນກຂາຍສົ່ງເອງ ຍັງມີບິນ ໜ້າຮ້ານ/ໂຄງການ ປົນມາ.
// ຄ່າແມ່ນລະຫັດ ar_group (101 ໜ້າຮ້ານ · 102 ຂາຍສົ່ງ · 103 ໂຄງການ …).
function channelClause(codes: string[], nextParam: number) {
  if (!codes.length) return { sql: "", params: [] as unknown[] };
  return { sql: `AND s.argroup_main = ANY($${nextParam})`, params: [codes] };
}

function num(v: string | number | null | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function dayCount(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

// Resolve which tier the line has reached. Tiers are compared by target_qty
// (not by the printed pct — several sheets label a tier 80% while its target is
// really 74% of the 100% figure), highest target first.
function resolveTier(tiers: CampaignTier[], actual: number) {
  const sorted = [...tiers].sort((a, b) => num(b.target_qty) - num(a.target_qty));
  const achievedIdx = sorted.findIndex((t) => actual >= num(t.target_qty));
  const achieved = achievedIdx >= 0 ? sorted[achievedIdx] : null;
  const next = achievedIdx === -1 ? sorted[sorted.length - 1] : achievedIdx > 0 ? sorted[achievedIdx - 1] : null;
  return { achieved, next, sorted };
}

export async function listCampaigns(): Promise<Campaign[]> {
  const { rows } = await pool.query<Campaign>(
    `SELECT id, name, description, date_from::text, date_to::text,
            scope_kind, scope_codes, reward_currency, status, note, created_by,
            exclude_gifts, split_rule, COALESCE(fallback_employee_code,'') AS fallback_employee_code,
            channel_codes
       FROM app_campaign
      ORDER BY date_from DESC, id DESC`,
  );
  return rows;
}

export async function getCampaign(id: number): Promise<Campaign | null> {
  const { rows } = await pool.query<Campaign>(
    `SELECT id, name, description, date_from::text, date_to::text,
            scope_kind, scope_codes, reward_currency, status, note, created_by,
            exclude_gifts, split_rule, COALESCE(fallback_employee_code,'') AS fallback_employee_code,
            channel_codes
       FROM app_campaign WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

// Campaign + lines + live actuals. One aggregate query joins every line of the
// campaign against the sales rows in its own date window.
export async function getCampaignWithLines(id: number): Promise<CampaignWithLines | null> {
  const campaign = await getCampaign(id);
  if (!campaign) return null;

  const { rows: lineRows } = await pool.query<LineRow>(
    `SELECT id, campaign_id, name, categories, brands, unit_bonus_brands,
            unit_bonus_per_unit::text, sort_order
       FROM app_campaign_line WHERE campaign_id = $1 ORDER BY sort_order, id`,
    [id],
  );
  if (lineRows.length === 0) {
    return { ...campaign, lines: [], totalBonus: 0, daysTotal: 0, daysElapsed: 0 };
  }

  const { rows: tierRows } = await pool.query<CampaignTier & { line_id: number }>(
    `SELECT t.id, t.line_id, t.pct::text, t.target_qty::text, t.bonus_amount::text
       FROM app_campaign_tier t
       JOIN app_campaign_line l ON l.id = t.line_id
      WHERE l.campaign_id = $1
      ORDER BY t.target_qty DESC`,
    [id],
  );

  const scope = scopeClause(campaign.scope_kind, campaign.scope_codes, 4);
  const chan = channelClause(campaign.channel_codes, 4 + scope.params.length);
  const { rows: actualRows } = await pool.query<{ line_id: number; actual: string; unit_bonus_qty: string }>(
    `SELECT l.id AS line_id,
            COALESCE(SUM(s.qty), 0)::text AS actual,
            COALESCE(SUM(s.qty) FILTER (
              WHERE CARDINALITY(l.unit_bonus_brands) > 0
                AND UPPER(TRIM(s.item_brand)) = ANY(l.unit_bonus_brands)
            ), 0)::text AS unit_bonus_qty
       FROM app_campaign_line l
       LEFT JOIN odg_sale_detail s
              ON s.doc_date BETWEEN $2 AND $3
             AND s.item_category = ANY(l.categories)
             AND (CARDINALITY(l.brands) = 0 OR UPPER(TRIM(s.item_brand)) = ANY(l.brands))
             ${giftClause(campaign.exclude_gifts)}
             ${scope.sql}
             ${chan.sql}
      WHERE l.campaign_id = $1
      GROUP BY l.id`,
    [id, campaign.date_from, campaign.date_to, ...scope.params, ...chan.params],
  );
  const actuals = new Map(actualRows.map((r) => [r.line_id, r]));

  const lines: CampaignLine[] = lineRows.map((l) => {
    const tiers = tierRows.filter((t) => t.line_id === l.id);
    const a = actuals.get(l.id);
    const actual = num(a?.actual);
    const unitBonusQty = num(a?.unit_bonus_qty);
    const { achieved, next, sorted } = resolveTier(tiers, actual);
    const target100 = num(sorted.find((t) => num(t.pct) === 100)?.target_qty ?? sorted[0]?.target_qty);
    const tierBonus = achieved ? num(achieved.bonus_amount) : 0;
    const unitBonus = unitBonusQty * num(l.unit_bonus_per_unit);
    return {
      ...l,
      tiers: sorted,
      actual,
      target100,
      pct: target100 > 0 ? (actual / target100) * 100 : 0,
      achievedTier: achieved,
      nextTier: next,
      gapToNext: next ? Math.max(0, num(next.target_qty) - actual) : 0,
      tierBonus,
      unitBonusQty,
      unitBonus,
      totalBonus: tierBonus + unitBonus,
    };
  });

  const today = new Date().toISOString().slice(0, 10);
  const daysTotal = dayCount(campaign.date_from, campaign.date_to);
  const daysElapsed = Math.min(
    daysTotal,
    today < campaign.date_from ? 0 : dayCount(campaign.date_from, today > campaign.date_to ? campaign.date_to : today),
  );

  return {
    ...campaign,
    lines,
    totalBonus: lines.reduce((s, l) => s + l.totalBonus, 0),
    daysTotal,
    daysElapsed,
  };
}

// Summary row for the campaign list — total units, total bonus, worst progress.
export type CampaignSummary = Campaign & {
  lineCount: number;
  totalBonus: number;
  minPct: number;
  daysTotal: number;
  daysElapsed: number;
};

export async function listCampaignSummaries(): Promise<CampaignSummary[]> {
  const campaigns = await listCampaigns();
  const detailed = await Promise.all(campaigns.map((c) => getCampaignWithLines(c.id)));
  return detailed.filter((c): c is CampaignWithLines => c !== null).map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    date_from: c.date_from,
    date_to: c.date_to,
    scope_kind: c.scope_kind,
    scope_codes: c.scope_codes,
    reward_currency: c.reward_currency,
    status: c.status,
    note: c.note,
    created_by: c.created_by,
    exclude_gifts: c.exclude_gifts,
    split_rule: c.split_rule,
    fallback_employee_code: c.fallback_employee_code,
    channel_codes: c.channel_codes,
    lineCount: c.lines.length,
    totalBonus: c.totalBonus,
    minPct: c.lines.length ? Math.min(...c.lines.map((l) => l.pct)) : 0,
    daysTotal: c.daysTotal,
    daysElapsed: c.daysElapsed,
  }));
}

// Per-salesperson contribution across every line of a campaign, plus the share
// of the bonus that person earns under the campaign's split_rule:
//   prorata — in proportion to their units in that line (default)
//   equal   — split evenly between everyone with units in that line
//   none    — team money, not split (per-unit brand bonus still theirs)
// The per-unit brand bonus (MIDEA/CENTON) always follows the person's own units.
export type SalesRow = {
  salename: string;
  department_name: string;
  units: string;
  bills: string;
  bonus: number;
  /** ຊື່ໃນບິນທີ່ຈັບຄູ່ພະນັກງານບໍ່ໄດ້ ແລ້ວຍົກມາໃຫ້ຫົວໜ້າທີມຄົນນີ້ */
  absorbed: string[];
};

export async function getCampaignBySalesperson(id: number): Promise<SalesRow[]> {
  const campaign = await getCampaignWithLines(id);
  if (!campaign) return [];
  const scope = scopeClause(campaign.scope_kind, campaign.scope_codes, 4);
  const chan = channelClause(campaign.channel_codes, 4 + scope.params.length);
  const gift = giftClause(campaign.exclude_gifts);

  // ຍອດຕໍ່ (ຄົນ × ໝວດ) — ພື້ນຖານຂອງການແບ່ງເງິນ
  const { rows: perLine } = await pool.query<{
    salename: string;
    department_name: string;
    employee_code: string;
    line_id: number;
    units: string;
    ub_units: string;
  }>(
    `SELECT COALESCE(NULLIF(TRIM(s.salename), ''), '(ບໍ່ລະບຸ)') AS salename,
            STRING_AGG(DISTINCT COALESCE(NULLIF(TRIM(s.department_name), ''), '-'), ', ') AS department_name,
            COALESCE(MAX(al.employee_code), MAX(em.employee_code), '') AS employee_code,
            l.id AS line_id,
            SUM(s.qty)::text AS units,
            COALESCE(SUM(s.qty) FILTER (
              WHERE CARDINALITY(l.unit_bonus_brands) > 0
                AND UPPER(TRIM(s.item_brand)) = ANY(l.unit_bonus_brands)), 0)::text AS ub_units
       FROM app_campaign_line l
       JOIN odg_sale_detail s
         ON s.doc_date BETWEEN $2 AND $3
        AND s.item_category = ANY(l.categories)
        AND (CARDINALITY(l.brands) = 0 OR UPPER(TRIM(s.item_brand)) = ANY(l.brands))
        ${gift}
        ${scope.sql}
        ${chan.sql}
       LEFT JOIN app_incentive_sale_alias al ON TRIM(al.salename) = TRIM(s.salename)
       LEFT JOIN odg_employee em ON TRIM(em.fullname_lo) = TRIM(s.salename)
      WHERE l.campaign_id = $1
      GROUP BY 1, l.id`,
    [id, campaign.date_from, campaign.date_to, ...scope.params, ...chan.params],
  );

  // ⚠️ ນັບບິນຕ່າງຫາກ — ບິນໜຶ່ງອາດມີຫຼາຍໝວດ ຈຶ່ງບວກຕໍ່ໝວດຈະນັບຊ້ຳ
  const { rows: billRows } = await pool.query<{ salename: string; bills: string }>(
    `SELECT COALESCE(NULLIF(TRIM(s.salename), ''), '(ບໍ່ລະບຸ)') AS salename,
            COUNT(DISTINCT s.doc_no)::text AS bills
       FROM odg_sale_detail s
      WHERE s.doc_date BETWEEN $2 AND $3
        AND EXISTS (
          SELECT 1 FROM app_campaign_line l
           WHERE l.campaign_id = $1
             AND s.item_category = ANY(l.categories)
             AND (CARDINALITY(l.brands) = 0 OR UPPER(TRIM(s.item_brand)) = ANY(l.brands))
        )
        ${gift}
        ${scope.sql}
        ${chan.sql}
      GROUP BY 1`,
    [id, campaign.date_from, campaign.date_to, ...scope.params, ...chan.params],
  );
  const bills = new Map(billRows.map((r) => [r.salename, r.bills]));

  // ຄົນທີ່ຈັບຄູ່ພະນັກງານບໍ່ໄດ້ ຍອດຕົກເປັນຂອງຫົວໜ້າທີມ (fallback_employee_code)
  const fallback = campaign.fallback_employee_code;
  let fallbackName = "";
  if (fallback) {
    const { rows } = await pool.query<{ fullname_lo: string }>(
      `SELECT fullname_lo FROM odg_employee WHERE employee_code = $1`,
      [fallback],
    );
    fallbackName = rows[0]?.fullname_lo ?? fallback;
  }
  const ownerOf = (r: { employee_code: string; salename: string }) =>
    r.employee_code || fallback || `name:${r.salename}`;
  const billsOf = (owner: string) => {
    const names = new Set(perLine.filter((r) => ownerOf(r) === owner).map((r) => r.salename));
    return String([...names].reduce((sum, n) => sum + num(bills.get(n) ?? 0), 0));
  };

  const merged = new Map<string, SalesRow>();
  for (const line of campaign.lines) {
    const people = perLine.filter((r) => r.line_id === line.id && num(r.units) > 0);
    const byOwner = new Map<string, number>();
    for (const r of people) byOwner.set(ownerOf(r), (byOwner.get(ownerOf(r)) ?? 0) + num(r.units));
    const total = [...byOwner.values()].reduce((sum, v) => sum + v, 0);
    for (const r of people) {
      const owner = ownerOf(r);
      const displayName = r.employee_code || !fallback ? r.salename : fallbackName || r.salename;
      const row = merged.get(owner) ?? {
        salename: displayName,
        department_name: r.department_name,
        units: "0",
        bills: "0",
        bonus: 0,
        absorbed: [],
      };
      if (!r.employee_code && fallback && r.salename !== row.salename && !row.absorbed.includes(r.salename)) {
        row.absorbed.push(r.salename);
      }
      row.units = String(num(row.units) + num(r.units));
      if (line.tierBonus > 0) {
        if (campaign.split_rule === "equal") row.bonus += (line.tierBonus / byOwner.size) * (num(r.units) / (byOwner.get(owner) ?? 1));
        else if (campaign.split_rule !== "none") {
          row.bonus += total > 0 ? line.tierBonus * (num(r.units) / total) : 0;
        }
      }
      const perUnit = num(line.unit_bonus_per_unit);
      if (perUnit > 0) row.bonus += num(r.ub_units) * perUnit;
      merged.set(owner, row);
    }
  }

  for (const [owner, row] of merged) row.bills = billsOf(owner);
  return [...merged.values()].sort((a, b) => num(b.units) - num(a.units));
}

// Per-department split — answers "which department is actually driving this".
export type DeptRow = { department_code: string; department_name: string; bu_name: string; units: string };

export async function getCampaignByDepartment(id: number): Promise<DeptRow[]> {
  const campaign = await getCampaign(id);
  if (!campaign) return [];
  const scope = scopeClause(campaign.scope_kind, campaign.scope_codes, 4);
  const chan = channelClause(campaign.channel_codes, 4 + scope.params.length);
  const { rows } = await pool.query<DeptRow>(
    `SELECT COALESCE(NULLIF(TRIM(s.department_code), ''), '-') AS department_code,
            COALESCE(NULLIF(TRIM(s.department_name), ''), '(ບໍ່ລະບຸ)') AS department_name,
            COALESCE(NULLIF(TRIM(s.bu_name), ''), '-') AS bu_name,
            SUM(s.qty)::text AS units
       FROM odg_sale_detail s
      WHERE s.doc_date BETWEEN $2 AND $3
        AND EXISTS (
          SELECT 1 FROM app_campaign_line l
           WHERE l.campaign_id = $1
             AND s.item_category = ANY(l.categories)
             AND (CARDINALITY(l.brands) = 0 OR UPPER(TRIM(s.item_brand)) = ANY(l.brands))
        )
        ${giftClause(campaign.exclude_gifts)}
        ${scope.sql}
        ${chan.sql}
      GROUP BY 1, 2, 3
      HAVING SUM(s.qty) <> 0
      ORDER BY SUM(s.qty) DESC`,
    [id, campaign.date_from, campaign.date_to, ...scope.params, ...chan.params],
  );
  return rows;
}

// Month-by-month units for the campaign, for the pace chart.
export type MonthRow = { ym: string; units: string };

export async function getCampaignByMonth(id: number): Promise<MonthRow[]> {
  const campaign = await getCampaign(id);
  if (!campaign) return [];
  const scope = scopeClause(campaign.scope_kind, campaign.scope_codes, 4);
  const chan = channelClause(campaign.channel_codes, 4 + scope.params.length);
  const { rows } = await pool.query<MonthRow>(
    `SELECT TO_CHAR(s.doc_date, 'YYYY-MM') AS ym, SUM(s.qty)::text AS units
       FROM odg_sale_detail s
      WHERE s.doc_date BETWEEN $2 AND $3
        AND EXISTS (
          SELECT 1 FROM app_campaign_line l
           WHERE l.campaign_id = $1
             AND s.item_category = ANY(l.categories)
             AND (CARDINALITY(l.brands) = 0 OR UPPER(TRIM(s.item_brand)) = ANY(l.brands))
        )
        ${giftClause(campaign.exclude_gifts)}
        ${scope.sql}
        ${chan.sql}
      GROUP BY 1 ORDER BY 1`,
    [id, campaign.date_from, campaign.date_to, ...scope.params, ...chan.params],
  );
  return rows;
}

// Category picker options for the campaign editor — every item_category that
// has actually sold in the last two years, with its Lao name.
export type CategoryOption = { code: string; name: string; units: string };

export async function listCategoryOptions(): Promise<CategoryOption[]> {
  const { rows } = await pool.query<CategoryOption>(
    `SELECT s.item_category AS code,
            COALESCE(MAX(NULLIF(TRIM(s.item_category_name), '')), s.item_category) AS name,
            SUM(s.qty)::text AS units
       FROM odg_sale_detail s
      WHERE COALESCE(s.item_category, '') <> ''
        AND s.doc_date >= CURRENT_DATE - INTERVAL '2 years'
      GROUP BY s.item_category
      ORDER BY 2`,
  );
  return rows;
}

// Customer-channel picker (ar_group) — 101 ໜ້າຮ້ານ · 102 ຂາຍສົ່ງ · 103 ໂຄງການ …
export type ChannelOption = { code: string; name: string };

export async function listChannelOptions(): Promise<ChannelOption[]> {
  const { rows } = await pool.query<ChannelOption>(
    `SELECT code, COALESCE(NULLIF(TRIM(name_1), ''), code) AS name
       FROM ar_group WHERE code ~ '^1[0-9]{2}$' ORDER BY code`,
  );
  return rows;
}

// Employee picker for the "ຫົວໜ້າທີມ" fallback.
export type EmployeeOption = { code: string; name: string };

export async function listEmployeeOptions(): Promise<EmployeeOption[]> {
  const { rows } = await pool.query<EmployeeOption>(
    `SELECT employee_code AS code, COALESCE(NULLIF(TRIM(fullname_lo), ''), employee_code) AS name
       FROM odg_employee
      WHERE employment_status = 'ACTIVE'
      ORDER BY 2`,
  );
  return rows;
}

// Department picker options for the scope selector.
export type DeptOption = { code: string; name: string; bu_name: string };

export async function listDepartmentOptions(): Promise<DeptOption[]> {
  const { rows } = await pool.query<DeptOption>(
    `SELECT s.department_code AS code,
            COALESCE(MAX(NULLIF(TRIM(s.department_name), '')), s.department_code) AS name,
            COALESCE(MAX(NULLIF(TRIM(s.bu_name), '')), '-') AS bu_name
       FROM odg_sale_detail s
      WHERE COALESCE(s.department_code, '') <> ''
        AND s.doc_date >= CURRENT_DATE - INTERVAL '1 year'
      GROUP BY s.department_code
      ORDER BY 2`,
  );
  return rows;
}
