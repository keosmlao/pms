"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withTx } from "@/lib/db";
import { getIsAdmin } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";

type TierInput = { pct: number; target_qty: number; bonus_amount: number };
type LineInput = {
  name: string;
  categories: string[];
  brands: string[];
  unit_bonus_brands: string[];
  unit_bonus_per_unit: number;
  tiers: TierInput[];
};
type CampaignInput = {
  id?: number;
  name: string;
  description: string;
  date_from: string;
  date_to: string;
  scope_kind: "all" | "department" | "bu";
  scope_codes: string[];
  reward_currency: string;
  status: string;
  note: string;
  exclude_gifts: boolean;
  split_rule: string;
  fallback_employee_code: string;
  channel_codes: string[];
  lines: LineInput[];
};

async function admin() {
  const user = await getCurrentUser();
  if (!user || !(await getIsAdmin(user.employeeCode))) return null;
  return user;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SPLIT_RULES: readonly string[] = ["prorata", "equal", "none"];

function cleanList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((v) => String(v).trim()).filter(Boolean))].slice(0, 100);
}

function cleanNumber(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

// Lines and tiers are replaced wholesale on every save — the editor always
// submits the complete campaign, so a diff would only add failure modes.
export async function saveCampaign(formData: FormData): Promise<void> {
  const user = await admin();
  if (!user) return;

  let input: CampaignInput;
  try {
    input = JSON.parse(String(formData.get("payload") ?? "")) as CampaignInput;
  } catch {
    return;
  }

  const name = String(input.name ?? "").trim();
  const from = String(input.date_from ?? "").trim();
  const to = String(input.date_to ?? "").trim();
  if (!name || !DATE_RE.test(from) || !DATE_RE.test(to) || from > to) return;

  const scopeKind = ["all", "department", "bu"].includes(input.scope_kind) ? input.scope_kind : "all";
  const splitRule = SPLIT_RULES.includes(input.split_rule) ? input.split_rule : "prorata";
  const leader = String(input.fallback_employee_code ?? "").trim().slice(0, 20);
  const channels = cleanList(input.channel_codes);
  const scopeCodes = scopeKind === "all" ? [] : cleanList(input.scope_codes);
  const lines = (Array.isArray(input.lines) ? input.lines : [])
    .map((l) => ({
      name: String(l.name ?? "").trim().slice(0, 120),
      categories: cleanList(l.categories),
      brands: cleanList(l.brands).map((b) => b.toUpperCase()),
      unit_bonus_brands: cleanList(l.unit_bonus_brands).map((b) => b.toUpperCase()),
      unit_bonus_per_unit: cleanNumber(l.unit_bonus_per_unit),
      tiers: (Array.isArray(l.tiers) ? l.tiers : [])
        .map((t) => ({
          pct: cleanNumber(t.pct),
          target_qty: cleanNumber(t.target_qty),
          bonus_amount: cleanNumber(t.bonus_amount),
        }))
        .filter((t) => t.target_qty > 0),
    }))
    .filter((l) => l.name && l.categories.length > 0);

  const campaignId = await withTx(async (client) => {
    let id = Number(input.id ?? 0);
    if (id > 0) {
      const { rowCount } = await client.query(
        `UPDATE app_campaign
            SET name = $2, description = NULLIF($3,''), date_from = $4, date_to = $5,
                scope_kind = $6, scope_codes = $7, reward_currency = $8, status = $9,
                note = NULLIF($10,''), exclude_gifts = $11, split_rule = $12,
                fallback_employee_code = $13, channel_codes = $14, updated_at = now()
          WHERE id = $1`,
        [id, name.slice(0, 200), String(input.description ?? "").trim().slice(0, 1000), from, to,
         scopeKind, scopeCodes, String(input.reward_currency ?? "THB").trim().slice(0, 10) || "THB",
         String(input.status ?? "active").trim().slice(0, 20) || "active",
         String(input.note ?? "").trim().slice(0, 1000), input.exclude_gifts !== false, splitRule, leader, channels],
      );
      if (!rowCount) return 0;
      await client.query(`DELETE FROM app_campaign_line WHERE campaign_id = $1`, [id]);
    } else {
      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO app_campaign (name, description, date_from, date_to, scope_kind, scope_codes,
                                   reward_currency, status, note, created_by, exclude_gifts, split_rule,
                                   fallback_employee_code, channel_codes)
         VALUES ($1, NULLIF($2,''), $3, $4, $5, $6, $7, $8, NULLIF($9,''), $10, $11, $12, $13, $14)
         RETURNING id`,
        [name.slice(0, 200), String(input.description ?? "").trim().slice(0, 1000), from, to,
         scopeKind, scopeCodes, String(input.reward_currency ?? "THB").trim().slice(0, 10) || "THB",
         String(input.status ?? "active").trim().slice(0, 20) || "active",
         String(input.note ?? "").trim().slice(0, 1000), user.employeeCode,
         input.exclude_gifts !== false, splitRule, leader, channels],
      );
      id = rows[0].id;
    }

    for (const [i, l] of lines.entries()) {
      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO app_campaign_line (campaign_id, name, categories, brands,
                                        unit_bonus_brands, unit_bonus_per_unit, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [id, l.name, l.categories, l.brands, l.unit_bonus_brands, l.unit_bonus_per_unit, i + 1],
      );
      const lineId = rows[0].id;
      for (const t of l.tiers) {
        await client.query(
          `INSERT INTO app_campaign_tier (line_id, pct, target_qty, bonus_amount) VALUES ($1,$2,$3,$4)`,
          [lineId, t.pct, t.target_qty, t.bonus_amount],
        );
      }
    }
    return id;
  });

  if (!campaignId) return;
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaignId}`);
  redirect(`/campaigns/${campaignId}`);
}

export async function deleteCampaign(formData: FormData): Promise<void> {
  const user = await admin();
  if (!user) return;
  const id = Number(formData.get("id") ?? "");
  if (!id) return;
  await withTx(async (client) => {
    await client.query(`DELETE FROM app_campaign WHERE id = $1`, [id]);
  });
  revalidatePath("/campaigns");
  redirect("/campaigns");
}
