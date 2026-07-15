"use server";

import { revalidatePath } from "next/cache";
import { pool } from "@/lib/db";
import { getIsAdmin } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";

export type PlanState = { error: string | null; success: string | null };

async function admin() {
  const user = await getCurrentUser();
  if (!user || !(await getIsAdmin(user.employeeCode))) return null;
  return user;
}

export async function addPlanItem(_prev: PlanState, formData: FormData): Promise<PlanState> {
  const user = await admin();
  if (!user) return { error: "ບໍ່ມີສິດ (ສະເພາະ admin)", success: null };
  const itemCode = String(formData.get("item_code") ?? "").trim();
  const qty = Number(formData.get("plan_qty") ?? "0");
  const supplier = String(formData.get("supplier_code") ?? "").trim();
  const target = String(formData.get("target_date") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  if (!itemCode) return { error: "ກະລຸນາເລືອກສິນຄ້າ", success: null };

  const ok = await pool.query(`SELECT 1 FROM ic_inventory WHERE code = $1`, [itemCode]);
  if (!ok.rowCount) return { error: "ບໍ່ພົບສິນຄ້າ", success: null };

  await pool.query(
    `INSERT INTO odg_purchase_plan_item (item_code, plan_qty, supplier_code, target_date, note, created_by)
     VALUES ($1, $2, $3, NULLIF($4,'')::date, $5, $6)`,
    [itemCode, Number.isNaN(qty) ? 0 : qty, supplier, target, note.slice(0, 255), user.employeeCode],
  );
  revalidatePath("/purchase-plan");
  return { error: null, success: "ເພີ່ມເຂົ້າແຜນແລ້ວ" };
}

export async function removePlanItem(_prev: PlanState, formData: FormData): Promise<PlanState> {
  const user = await admin();
  if (!user) return { error: "ບໍ່ມີສິດ", success: null };
  const id = Number(formData.get("id") ?? "");
  if (!id) return { error: "ຂໍ້ມູນບໍ່ຄົບ", success: null };
  await pool.query(`DELETE FROM odg_purchase_plan_item WHERE id = $1`, [id]);
  revalidatePath("/purchase-plan");
  return { error: null, success: null };
}

export async function markOrdered(_prev: PlanState, formData: FormData): Promise<PlanState> {
  const user = await admin();
  if (!user) return { error: "ບໍ່ມີສິດ", success: null };
  const id = Number(formData.get("id") ?? "");
  if (!id) return { error: "ຂໍ້ມູນບໍ່ຄົບ", success: null };
  await pool.query(`UPDATE odg_purchase_plan_item SET status = 'ordered' WHERE id = $1`, [id]);
  revalidatePath("/purchase-plan");
  return { error: null, success: null };
}
