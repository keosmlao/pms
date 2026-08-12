"use server";

import { revalidatePath } from "next/cache";
import { pool } from "@/lib/db";
import { getUserScope } from "@/lib/loyalty";
import { isConfigSchemaReady } from "@/lib/loyalty-config";
import { getIsAdmin } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";

export type ConfigActionState = { error: string | null; success: string | null };

type Actor = { employeeCode: string; isAdmin: boolean; channelCodes: string[]; isScoped: boolean };

// Same rule as the page: admins, or anyone carrying a responsibility. A scoped
// user may only touch rules for a channel they are responsible for.
async function requireActor(): Promise<Actor | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const [isAdmin, scope] = await Promise.all([
    getIsAdmin(user.employeeCode),
    getUserScope(user.employeeCode),
  ]);
  if (!isAdmin && !scope.isScoped) return null;
  return {
    employeeCode: user.employeeCode,
    isAdmin,
    channelCodes: scope.channelCodes,
    isScoped: scope.isScoped,
  };
}

function mayTouchChannel(actor: Actor, channelGroup: string): boolean {
  if (actor.isAdmin) return true;
  // '' means the rule applies to every channel — only an admin may set that.
  if (!channelGroup) return false;
  return actor.channelCodes.includes(channelGroup);
}

async function writeLog(
  entity: string,
  entityId: string,
  action: string,
  before: unknown,
  after: unknown,
  by: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO odg_loyalty_config_log
            (entity, entity_id, action, before_json, after_json, changed_by)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)`,
    [
      entity,
      entityId,
      action,
      before === null ? null : JSON.stringify(before),
      after === null ? null : JSON.stringify(after),
      by,
    ],
  );
}

function parseRuleForm(formData: FormData) {
  const channelGroup = String(formData.get("channel_group") ?? "").trim();
  const buCode = String(formData.get("bu_code") ?? "").trim();
  const kip = Number(String(formData.get("kip_per_point") ?? "").replace(/,/g, "").trim());
  const multiplier = Number(String(formData.get("multiplier") ?? "1").trim());
  const fromDate = String(formData.get("from_date") ?? "").trim();
  const toDateRaw = String(formData.get("to_date") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim().slice(0, 255);
  const isActive = formData.get("is_active") ? 1 : 0;
  return { channelGroup, buCode, kip, multiplier, fromDate, toDate: toDateRaw || null, note, isActive };
}

function validateRule(r: ReturnType<typeof parseRuleForm>): string | null {
  if (!Number.isFinite(r.kip) || r.kip <= 0) return "ກີບຕໍ່ແຕ້ມຕ້ອງເປັນຕົວເລກຫຼາຍກວ່າ 0";
  if (!Number.isFinite(r.multiplier) || r.multiplier <= 0) return "ຕົວຄູນຕ້ອງຫຼາຍກວ່າ 0";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.fromDate)) return "ກະລຸນາເລືອກວັນເລີ່ມ";
  if (r.toDate && !/^\d{4}-\d{2}-\d{2}$/.test(r.toDate)) return "ຮູບແບບວັນສິ້ນສຸດບໍ່ຖືກຕ້ອງ";
  if (r.toDate && r.toDate < r.fromDate) return "ວັນສິ້ນສຸດຕ້ອງບໍ່ກ່ອນວັນເລີ່ມ";
  return null;
}

export async function saveEarnRule(
  _previous: ConfigActionState,
  formData: FormData,
): Promise<ConfigActionState> {
  const actor = await requireActor();
  if (!actor) return { error: "ບໍ່ມີສິດ", success: null };
  if (!(await isConfigSchemaReady())) {
    return { error: "ຍັງບໍ່ໄດ້ຣັນ migration 003 — ຕາຕະລາງຕັ້ງຄ່າຍັງບໍ່ມີ", success: null };
  }

  const r = parseRuleForm(formData);
  const invalid = validateRule(r);
  if (invalid) return { error: invalid, success: null };
  if (!mayTouchChannel(actor, r.channelGroup)) {
    return { error: "ຕັ້ງໄດ້ສະເພາະຊ່ອງທາງທີ່ທ່ານຮັບຜິດຊອບ", success: null };
  }

  const id = String(formData.get("id") ?? "").trim();

  try {
    if (id) {
      const { rows: beforeRows } = await pool.query(
        `SELECT * FROM odg_loyalty_earn_rule WHERE id = $1`,
        [id],
      );
      const before = beforeRows[0];
      if (!before) return { error: "ບໍ່ພົບກົດນີ້", success: null };
      if (!mayTouchChannel(actor, before.channel_group)) {
        return { error: "ຕັ້ງໄດ້ສະເພາະຊ່ອງທາງທີ່ທ່ານຮັບຜິດຊອບ", success: null };
      }

      const { rows: afterRows } = await pool.query(
        `UPDATE odg_loyalty_earn_rule
            SET channel_group = $1, bu_code = $2, kip_per_point = $3, multiplier = $4,
                from_date = $5, to_date = $6, note = $7, is_active = $8,
                updated_by = $9, updated_at = CURRENT_TIMESTAMP
          WHERE id = $10 RETURNING *`,
        [r.channelGroup, r.buCode, r.kip, r.multiplier, r.fromDate, r.toDate, r.note, r.isActive, actor.employeeCode, id],
      );
      await writeLog("earn_rule", id, "update", before, afterRows[0], actor.employeeCode);
      revalidatePath("/loyalty");
      return { error: null, success: "ບັນທຶກການແກ້ໄຂແລ້ວ" };
    }

    const { rows: afterRows } = await pool.query(
      `INSERT INTO odg_loyalty_earn_rule
              (channel_group, bu_code, kip_per_point, multiplier, from_date, to_date,
               note, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [r.channelGroup, r.buCode, r.kip, r.multiplier, r.fromDate, r.toDate, r.note, r.isActive, actor.employeeCode],
    );
    await writeLog("earn_rule", String(afterRows[0].id), "create", null, afterRows[0], actor.employeeCode);
    revalidatePath("/loyalty");
    return { error: null, success: "ເພີ່ມກົດອັດຕາແລ້ວ" };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes("odg_loyalty_earn_rule_unique")) {
      return { error: "ມີກົດຂອງ ຊ່ອງທາງ + BU + ວັນເລີ່ມ ນີ້ຢູ່ແລ້ວ", success: null };
    }
    return { error: `ບັນທຶກບໍ່ສຳເລັດ: ${message}`, success: null };
  }
}

export async function deleteEarnRule(
  _previous: ConfigActionState,
  formData: FormData,
): Promise<ConfigActionState> {
  const actor = await requireActor();
  if (!actor) return { error: "ບໍ່ມີສິດ", success: null };
  if (!(await isConfigSchemaReady())) {
    return { error: "ຍັງບໍ່ໄດ້ຣັນ migration 003", success: null };
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "ຂໍ້ມູນບໍ່ຄົບ", success: null };

  const { rows } = await pool.query(`SELECT * FROM odg_loyalty_earn_rule WHERE id = $1`, [id]);
  const before = rows[0];
  if (!before) return { error: "ບໍ່ພົບກົດນີ້", success: null };
  if (!mayTouchChannel(actor, before.channel_group)) {
    return { error: "ລຶບໄດ້ສະເພາະຊ່ອງທາງທີ່ທ່ານຮັບຜິດຊອບ", success: null };
  }

  await pool.query(`DELETE FROM odg_loyalty_earn_rule WHERE id = $1`, [id]);
  await writeLog("earn_rule", id, "delete", before, null, actor.employeeCode);
  revalidatePath("/loyalty");
  return { error: null, success: "ລຶບກົດແລ້ວ" };
}

// Tier thresholds and per-customer overrides (migration 005). Admin only —
// changing a threshold moves every customer at once, which is not something a
// single channel owner should be able to do.
async function tierReady(): Promise<boolean> {
  const { rows } = await pool.query<{ ok: boolean }>(
    `SELECT (to_regclass('public.odg_member_tier_rule') IS NOT NULL
             AND to_regclass('public.odg_member_tier_override') IS NOT NULL) AS ok`,
  );
  return rows[0]?.ok ?? false;
}

export async function saveTierRule(
  _previous: ConfigActionState,
  formData: FormData,
): Promise<ConfigActionState> {
  const actor = await requireActor();
  if (!actor) return { error: "ບໍ່ມີສິດ", success: null };
  if (!actor.isAdmin) return { error: "ສະເພາະ admin ຈຶ່ງແກ້ເກນລະດັບໄດ້", success: null };
  if (!(await tierReady())) return { error: "ຍັງບໍ່ໄດ້ຣັນ migration 005", success: null };

  const id = String(formData.get("id") ?? "").trim();
  const minPoints = Number(String(formData.get("min_points") ?? "").replace(/,/g, "").trim());
  const isActive = formData.get("is_active") ? 1 : 0;
  const note = String(formData.get("note") ?? "").trim().slice(0, 255);
  if (!id) return { error: "ຂໍ້ມູນບໍ່ຄົບ", success: null };
  if (!Number.isFinite(minPoints) || minPoints < 0) {
    return { error: "ເກນແຕ້ມຕ້ອງເປັນ 0 ຫຼື ຫຼາຍກວ່າ", success: null };
  }

  const { rows: before } = await pool.query(`SELECT * FROM odg_member_tier_rule WHERE id = $1`, [id]);
  if (!before[0]) return { error: "ບໍ່ພົບເກນນີ້", success: null };

  const { rows: after } = await pool.query(
    `UPDATE odg_member_tier_rule
        SET min_points = $1, is_active = $2, note = $3,
            updated_by = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5 RETURNING *`,
    [minPoints, isActive, note, actor.employeeCode, id],
  );
  await writeLog("tier_rule", id, "update", before[0], after[0], actor.employeeCode);
  revalidatePath("/loyalty");
  return { error: null, success: "ບັນທຶກເກນລະດັບແລ້ວ" };
}

export async function setTierOverride(
  _previous: ConfigActionState,
  formData: FormData,
): Promise<ConfigActionState> {
  const actor = await requireActor();
  if (!actor) return { error: "ບໍ່ມີສິດ", success: null };
  if (!actor.isAdmin) return { error: "ສະເພາະ admin ຈຶ່ງຕັ້ງລະດັບເປັນລາຍຄົນໄດ້", success: null };
  if (!(await tierReady())) return { error: "ຍັງບໍ່ໄດ້ຣັນ migration 005", success: null };

  const custCode = String(formData.get("cust_code") ?? "").trim();
  const year = Number(String(formData.get("year") ?? "").trim());
  const tierCode = String(formData.get("tier_code") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 255);
  if (!custCode || !Number.isFinite(year)) return { error: "ຂໍ້ມູນບໍ່ຄົບ", success: null };

  // Empty tier clears the override and hands the customer back to the rules.
  if (!tierCode) {
    const { rows } = await pool.query(
      `DELETE FROM odg_member_tier_override WHERE cust_code = $1 AND year = $2 RETURNING *`,
      [custCode, year],
    );
    if (rows[0]) await writeLog("tier_override", `${custCode}/${year}`, "delete", rows[0], null, actor.employeeCode);
    revalidatePath("/loyalty");
    return { error: null, success: rows[0] ? "ຍົກເລີກການຕັ້ງມືແລ້ວ" : "ບໍ່ມີການຕັ້ງມືຢູ່ກ່ອນ" };
  }

  const { rows: valid } = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM odg_member_level WHERE code = $1`,
    [tierCode],
  );
  if (!valid[0]?.n) return { error: "ລະດັບບໍ່ຖືກຕ້ອງ", success: null };

  const { rows } = await pool.query(
    `INSERT INTO odg_member_tier_override (cust_code, year, tier_code, reason, changed_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (cust_code, year)
     DO UPDATE SET tier_code = EXCLUDED.tier_code, reason = EXCLUDED.reason,
                   changed_by = EXCLUDED.changed_by, changed_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [custCode, year, tierCode, reason, actor.employeeCode],
  );
  await writeLog("tier_override", `${custCode}/${year}`, "update", null, rows[0], actor.employeeCode);
  revalidatePath("/loyalty");
  return { error: null, success: `ຕັ້ງລະດັບໃຫ້ ${custCode} ແລ້ວ` };
}

// ic_inventory_detail is the ERP's product master, so this writes exactly one
// column and records the previous value first — that history is the only way to
// answer later whether a product was earning points on the day of a given sale.
export async function toggleProductPoint(
  _previous: ConfigActionState,
  formData: FormData,
): Promise<ConfigActionState> {
  const actor = await requireActor();
  if (!actor) return { error: "ບໍ່ມີສິດ", success: null };

  const { rows: ready } = await pool.query<{ ok: boolean }>(
    `SELECT to_regclass('public.odg_product_point_log') IS NOT NULL AS ok`,
  );
  if (!ready[0]?.ok) {
    return { error: "ຍັງບໍ່ໄດ້ຣັນ migration 004 — ບໍ່ມີຕາຕະລາງປະຫວັດ ຈຶ່ງຍັງແກ້ບໍ່ໄດ້", success: null };
  }

  const icCode = String(formData.get("ic_code") ?? "").trim();
  const next = String(formData.get("next") ?? "") === "1" ? 1 : 0;
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 255);
  if (!icCode) return { error: "ຂໍ້ມູນບໍ່ຄົບ", success: null };

  const { rows: cur } = await pool.query<{ have_point: number | null; group_main: string; group_sub: string }>(
    `SELECT d.have_point, COALESCE(i.group_main, '') AS group_main, COALESCE(i.group_sub, '') AS group_sub
       FROM ic_inventory_detail d JOIN ic_inventory i ON i.code = d.ic_code
      WHERE d.ic_code = $1`,
    [icCode],
  );
  if (!cur[0]) return { error: "ບໍ່ພົບສິນຄ້ານີ້", success: null };

  // Non-admins may only touch products in a group they are responsible for.
  if (!actor.isAdmin) {
    const { rows: owns } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM odg_group_responsible
        WHERE employee_code = $1 AND group_main = $2
          AND (group_sub = '' OR group_sub = $3)`,
      [actor.employeeCode, cur[0].group_main, cur[0].group_sub],
    );
    if (!owns[0]?.n) return { error: "ແກ້ໄດ້ສະເພາະກຸ່ມສິນຄ້າທີ່ທ່ານຮັບຜິດຊອບ", success: null };
  }

  const before = cur[0].have_point;
  if (Number(before ?? 0) === next) {
    return { error: null, success: "ຄ່າເປັນແບບນີ້ຢູ່ແລ້ວ" };
  }

  await pool.query(`UPDATE ic_inventory_detail SET have_point = $1 WHERE ic_code = $2`, [next, icCode]);
  await pool.query(
    `INSERT INTO odg_product_point_log (ic_code, before_value, after_value, reason, changed_by)
     VALUES ($1, $2, $3, $4, $5)`,
    [icCode, before, next, reason, actor.employeeCode],
  );

  revalidatePath("/loyalty");
  return {
    error: null,
    success: `${icCode} → ${next === 1 ? "ຮ່ວມລາຍການ" : "ບໍ່ຮ່ວມລາຍການ"}`,
  };
}

// Campaign headers are written by the promotion system too, so this touches
// only the control fields and always records a before/after in the log.
export async function saveCampaignHeader(
  _previous: ConfigActionState,
  formData: FormData,
): Promise<ConfigActionState> {
  const actor = await requireActor();
  if (!actor) return { error: "ບໍ່ມີສິດ", success: null };
  if (!(await isConfigSchemaReady())) {
    return { error: "ຍັງບໍ່ໄດ້ຣັນ migration 003 — ບໍ່ມີຕາຕະລາງບັນທຶກການແກ້ໄຂ", success: null };
  }

  const proCode = String(formData.get("pro_code") ?? "").trim();
  if (!proCode) return { error: "ຂໍ້ມູນບໍ່ຄົບ", success: null };

  const channelGroup = String(formData.get("channel_group") ?? "").trim();
  const fromDate = String(formData.get("from_date") ?? "").trim();
  const toDate = String(formData.get("to_date") ?? "").trim();
  const startExchange = String(formData.get("start_exchange") ?? "").trim() || null;
  const endExchange = String(formData.get("end_exchange") ?? "").trim() || null;
  const isActive = formData.get("is_active") ? 1 : 0;
  const isRedeem = formData.get("is_redeem") ? 1 : 0;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
    return { error: "ກະລຸນາໃສ່ວັນເລີ່ມ ແລະ ວັນສິ້ນສຸດ", success: null };
  }
  if (toDate < fromDate) return { error: "ວັນສິ້ນສຸດຕ້ອງບໍ່ກ່ອນວັນເລີ່ມ", success: null };
  if (startExchange && endExchange && endExchange < startExchange) {
    return { error: "ວັນສິ້ນສຸດການແລກຕ້ອງບໍ່ກ່ອນວັນເລີ່ມແລກ", success: null };
  }

  const { rows: beforeRows } = await pool.query(
    `SELECT pro_code, pro_name, channel_group, from_date, to_date,
            start_exchange, end_exchange, is_active, is_redeem
       FROM odg_pomotion_colection_point WHERE pro_code = $1`,
    [proCode],
  );
  const before = beforeRows[0];
  if (!before) return { error: "ບໍ່ພົບໂປຣນີ້", success: null };
  if (!mayTouchChannel(actor, before.channel_group) || !mayTouchChannel(actor, channelGroup)) {
    return { error: "ແກ້ໄດ້ສະເພາະໂປຣຂອງຊ່ອງທາງທີ່ທ່ານຮັບຜິດຊອບ", success: null };
  }

  const { rows: afterRows } = await pool.query(
    `UPDATE odg_pomotion_colection_point
        SET channel_group = $1, from_date = $2, to_date = $3,
            start_exchange = $4, end_exchange = $5, is_active = $6, is_redeem = $7
      WHERE pro_code = $8
      RETURNING pro_code, pro_name, channel_group, from_date, to_date,
                start_exchange, end_exchange, is_active, is_redeem`,
    [channelGroup, fromDate, toDate, startExchange, endExchange, isActive, isRedeem, proCode],
  );
  await writeLog("campaign", proCode, "update", before, afterRows[0], actor.employeeCode);
  revalidatePath("/loyalty");
  return { error: null, success: `ບັນທຶກໂປຣ ${proCode} ແລ້ວ` };
}
