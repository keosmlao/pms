"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getIsAdmin } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";

export type WeeklyState = { error: string | null; success: string | null };

async function admin() {
  const user = await getCurrentUser();
  if (!user || !(await getIsAdmin(user.employeeCode))) return null;
  return user;
}

export async function createWeeklyPlan(_prev: WeeklyState, formData: FormData): Promise<WeeklyState> {
  const user = await admin();
  if (!user) return { error: "ບໍ່ມີສິດ (ສະເພາະ admin)", success: null };
  const title = String(formData.get("title") ?? "").trim();
  const year = Number(formData.get("plan_year") ?? "");
  const startWeek = Number(formData.get("start_week") ?? "");
  const saleWeeks = Number(formData.get("sale_weeks") ?? "13");
  const arrivalWeeks = Number(formData.get("arrival_weeks") ?? "13");
  if (!title) return { error: "ກະລຸນາໃສ່ຊື່ແຜນ", success: null };
  if (!year || year < 2020 || year > 2100) return { error: "ປີບໍ່ຖືກຕ້ອງ", success: null };
  if (!startWeek || startWeek < 1 || startWeek > 53) return { error: "ອາທິດເລີ່ມບໍ່ຖືກຕ້ອງ (1-53)", success: null };
  if (!saleWeeks || saleWeeks < 1 || saleWeeks > 30 || !arrivalWeeks || arrivalWeeks < 1 || arrivalWeeks > 30)
    return { error: "ຈຳນວນອາທິດຕ້ອງຢູ່ລະຫວ່າງ 1-30", success: null };

  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO odg_pm_weekly_plan (title, plan_year, start_week, sale_weeks, arrival_weeks, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [title.slice(0, 120), year, startWeek, saleWeeks, arrivalWeeks, user.employeeCode],
  );
  revalidatePath("/purchase-plan/weekly");
  redirect(`/purchase-plan/weekly/${rows[0].id}`);
}

export async function deleteWeeklyPlan(_prev: WeeklyState, formData: FormData): Promise<WeeklyState> {
  const user = await admin();
  if (!user) return { error: "ບໍ່ມີສິດ", success: null };
  const id = Number(formData.get("id") ?? "");
  if (!id) return { error: "ຂໍ້ມູນບໍ່ຄົບ", success: null };
  await pool.query(`DELETE FROM odg_pm_weekly_plan WHERE id = $1`, [id]);
  revalidatePath("/purchase-plan/weekly");
  return { error: null, success: null };
}

export async function addWeeklyItem(_prev: WeeklyState, formData: FormData): Promise<WeeklyState> {
  const user = await admin();
  if (!user) return { error: "ບໍ່ມີສິດ", success: null };
  const planId = Number(formData.get("plan_id") ?? "");
  const itemCode = String(formData.get("item_code") ?? "").trim();
  const modelText = String(formData.get("model") ?? "").trim();
  const grp = String(formData.get("grp") ?? "").trim().toUpperCase();
  const period = String(formData.get("plan_period") ?? "week") === "month" ? "month" : "week";
  if (!planId) return { error: "ຂໍ້ມູນບໍ່ຄົບ", success: null };
  if (!itemCode && !modelText) return { error: "ເລືອກສິນຄ້າ ຫຼື ພິມຊື່ໂມເດວ", success: null };

  let model = modelText;
  let stock = 0;
  let code: string | null = null;
  if (itemCode) {
    const inv = await pool.query<{ code: string; name_1: string; balance_qty: string }>(
      `SELECT code, COALESCE(name_1,'') AS name_1, COALESCE(balance_qty,0)::text AS balance_qty
         FROM ic_inventory WHERE code = $1`,
      [itemCode],
    );
    if (!inv.rowCount) return { error: "ບໍ່ພົບສິນຄ້າ", success: null };
    code = inv.rows[0].code;
    stock = Number(inv.rows[0].balance_qty) || 0;
    if (!model) model = inv.rows[0].name_1.split(" ").pop() || code;
  }

  try {
    await pool.query(
      `INSERT INTO odg_pm_weekly_plan_item (plan_id, item_code, model, grp, stock_qty, plan_period, sort)
       VALUES ($1, $2, $3, $4, $5, $6,
               COALESCE((SELECT MAX(sort) + 1 FROM odg_pm_weekly_plan_item WHERE plan_id = $1), 0))`,
      [planId, code, model.slice(0, 80), grp.slice(0, 30), stock, period],
    );
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return { error: "ໂມເດວນີ້ມີໃນແຜນແລ້ວ", success: null };
    throw e;
  }
  revalidatePath(`/purchase-plan/weekly/${planId}`);
  return { error: null, success: "ເພີ່ມແລ້ວ" };
}

export async function setItemPeriod(planId: number, itemId: number, period: "week" | "month"): Promise<WeeklyState> {
  const user = await admin();
  if (!user) return { error: "ບໍ່ມີສິດ", success: null };
  if (!planId || !itemId || (period !== "week" && period !== "month"))
    return { error: "ຂໍ້ມູນບໍ່ຄົບ", success: null };
  await pool.query(
    `UPDATE odg_pm_weekly_plan_item SET plan_period = $3 WHERE id = $2 AND plan_id = $1`,
    [planId, itemId, period],
  );
  revalidatePath(`/purchase-plan/weekly/${planId}`);
  return { error: null, success: null };
}

export async function removeWeeklyItem(_prev: WeeklyState, formData: FormData): Promise<WeeklyState> {
  const user = await admin();
  if (!user) return { error: "ບໍ່ມີສິດ", success: null };
  const id = Number(formData.get("id") ?? "");
  const planId = Number(formData.get("plan_id") ?? "");
  if (!id || !planId) return { error: "ຂໍ້ມູນບໍ່ຄົບ", success: null };
  await pool.query(`DELETE FROM odg_pm_weekly_plan_item WHERE id = $1 AND plan_id = $2`, [id, planId]);
  revalidatePath(`/purchase-plan/weekly/${planId}`);
  return { error: null, success: null };
}

export type CellChange = { itemId: number; kind: "sale" | "arrival"; week: number; qty: number };

export async function saveWeeklyCells(planId: number, changes: CellChange[]): Promise<WeeklyState> {
  const user = await admin();
  if (!user) return { error: "ບໍ່ມີສິດ", success: null };
  if (!planId || !Array.isArray(changes) || changes.length === 0)
    return { error: null, success: null };

  const clean = changes.filter(
    (c) =>
      Number.isFinite(c.itemId) &&
      (c.kind === "sale" || c.kind === "arrival") &&
      Number.isInteger(c.week) &&
      Number.isFinite(c.qty) &&
      c.qty >= 0,
  );
  if (!clean.length) return { error: "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ", success: null };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO odg_pm_weekly_plan_cell (item_id, kind, week_no, qty)
       SELECT t.item_id, t.kind, t.week_no, t.qty
         FROM unnest($1::bigint[], $2::text[], $3::int[], $4::numeric[])
              AS t(item_id, kind, week_no, qty)
         JOIN odg_pm_weekly_plan_item it ON it.id = t.item_id AND it.plan_id = $5
       ON CONFLICT (item_id, kind, week_no) DO UPDATE SET qty = EXCLUDED.qty`,
      [
        clean.map((c) => c.itemId),
        clean.map((c) => c.kind),
        clean.map((c) => c.week),
        clean.map((c) => c.qty),
        planId,
      ],
    );
    await client.query(`UPDATE odg_pm_weekly_plan SET updated_at = now() WHERE id = $1`, [planId]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  revalidatePath(`/purchase-plan/weekly/${planId}`);
  return { error: null, success: `ບັນທຶກ ${clean.length} ຊ່ອງແລ້ວ` };
}

export async function refreshStock(_prev: WeeklyState, formData: FormData): Promise<WeeklyState> {
  const user = await admin();
  if (!user) return { error: "ບໍ່ມີສິດ", success: null };
  const planId = Number(formData.get("plan_id") ?? "");
  if (!planId) return { error: "ຂໍ້ມູນບໍ່ຄົບ", success: null };
  await pool.query(
    `UPDATE odg_pm_weekly_plan_item it
        SET stock_qty = COALESCE(i.balance_qty, 0)
       FROM ic_inventory i
      WHERE i.code = it.item_code AND it.plan_id = $1`,
    [planId],
  );
  revalidatePath(`/purchase-plan/weekly/${planId}`);
  return { error: null, success: "ອັບເດດ stock ຈາກ ERP ແລ້ວ" };
}
