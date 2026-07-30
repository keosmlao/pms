"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getIsAdmin } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";

export type MonthlyState = { error: string | null; success: string | null };

async function admin() {
  const user = await getCurrentUser();
  if (!user || !(await getIsAdmin(user.employeeCode))) return null;
  return user;
}

export async function createMonthlyPlan(_prev: MonthlyState, formData: FormData): Promise<MonthlyState> {
  const user = await admin();
  if (!user) return { error: "ບໍ່ມີສິດ (ສະເພາະ admin)", success: null };
  const title = String(formData.get("title") ?? "").trim();
  const year = Number(formData.get("plan_year") ?? "");
  if (!title) return { error: "ກະລຸນາໃສ່ຊື່ແຜນ", success: null };
  if (!year || year < 2020 || year > 2100) return { error: "ປີບໍ່ຖືກຕ້ອງ", success: null };
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO odg_pm_monthly_plan (title, plan_year, created_by) VALUES ($1,$2,$3) RETURNING id`,
    [title.slice(0, 120), year, user.employeeCode],
  );
  revalidatePath("/purchase-plan/monthly");
  redirect(`/purchase-plan/monthly/${rows[0].id}`);
}

export async function deleteMonthlyPlan(_prev: MonthlyState, formData: FormData): Promise<MonthlyState> {
  const user = await admin();
  if (!user) return { error: "ບໍ່ມີສິດ", success: null };
  const id = Number(formData.get("id") ?? "");
  if (!id) return { error: "ຂໍ້ມູນບໍ່ຄົບ", success: null };
  await pool.query(`DELETE FROM odg_pm_monthly_plan WHERE id = $1`, [id]);
  revalidatePath("/purchase-plan/monthly");
  return { error: null, success: null };
}

export async function addMonthlyItem(_prev: MonthlyState, formData: FormData): Promise<MonthlyState> {
  const user = await admin();
  if (!user) return { error: "ບໍ່ມີສິດ", success: null };
  const planId = Number(formData.get("plan_id") ?? "");
  const itemCode = String(formData.get("item_code") ?? "").trim();
  if (!planId || !itemCode) return { error: "ເລືອກສິນຄ້າ", success: null };
  const ok = await pool.query(`SELECT 1 FROM ic_inventory WHERE code = $1`, [itemCode]);
  if (!ok.rowCount) return { error: "ບໍ່ພົບສິນຄ້າ", success: null };
  try {
    await pool.query(
      `INSERT INTO odg_pm_monthly_plan_item (plan_id, item_code, sort)
       VALUES ($1, $2, COALESCE((SELECT MAX(sort)+1 FROM odg_pm_monthly_plan_item WHERE plan_id=$1), 0))`,
      [planId, itemCode],
    );
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return { error: "ສິນຄ້ານີ້ມີໃນແຜນແລ້ວ", success: null };
    throw e;
  }
  revalidatePath(`/purchase-plan/monthly/${planId}`);
  return { error: null, success: "ເພີ່ມແລ້ວ" };
}

export async function removeMonthlyItem(_prev: MonthlyState, formData: FormData): Promise<MonthlyState> {
  const user = await admin();
  if (!user) return { error: "ບໍ່ມີສິດ", success: null };
  const id = Number(formData.get("id") ?? "");
  const planId = Number(formData.get("plan_id") ?? "");
  if (!id || !planId) return { error: "ຂໍ້ມູນບໍ່ຄົບ", success: null };
  await pool.query(`DELETE FROM odg_pm_monthly_plan_item WHERE id = $1 AND plan_id = $2`, [id, planId]);
  revalidatePath(`/purchase-plan/monthly/${planId}`);
  return { error: null, success: null };
}

export type MonthCell = { itemId: number; month: number; qty: number };

export async function saveMonthlyCells(planId: number, changes: MonthCell[]): Promise<MonthlyState> {
  const user = await admin();
  if (!user) return { error: "ບໍ່ມີສິດ", success: null };
  if (!planId || !Array.isArray(changes) || !changes.length) return { error: null, success: null };
  const clean = changes.filter(
    (c) => Number.isFinite(c.itemId) && Number.isInteger(c.month) && c.month >= 1 && c.month <= 12 && Number.isFinite(c.qty) && c.qty >= 0,
  );
  if (!clean.length) return { error: "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ", success: null };
  await pool.query(
    `INSERT INTO odg_pm_monthly_plan_cell (item_id, month, qty)
     SELECT t.item_id, t.month, t.qty
       FROM unnest($1::bigint[], $2::int[], $3::numeric[]) AS t(item_id, month, qty)
       JOIN odg_pm_monthly_plan_item it ON it.id = t.item_id AND it.plan_id = $4
     ON CONFLICT (item_id, month) DO UPDATE SET qty = EXCLUDED.qty`,
    [clean.map((c) => c.itemId), clean.map((c) => c.month), clean.map((c) => c.qty), planId],
  );
  revalidatePath(`/purchase-plan/monthly/${planId}`);
  return { error: null, success: `ບັນທຶກ ${clean.length} ຊ່ອງແລ້ວ` };
}
