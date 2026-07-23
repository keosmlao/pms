"use server";

import { revalidatePath } from "next/cache";
import { pool } from "@/lib/db";
import { getIsAdmin } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";

async function admin() {
  const user = await getCurrentUser();
  if (!user || !(await getIsAdmin(user.employeeCode))) return null;
  return user;
}

export async function updatePolicy(formData: FormData): Promise<void> {
  const user = await admin();
  if (!user) return;
  const id = Number(formData.get("id") ?? "");
  const stockMonths = Number(formData.get("stock_months") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!id || !Number.isFinite(stockMonths) || stockMonths < 0 || stockMonths > 24) return;
  await pool.query(
    `UPDATE odg_stock_policy
        SET stock_months = $2, reason = NULLIF($3,''), updated_by = $4, updated_at = now()
      WHERE id = $1`,
    [id, stockMonths, reason.slice(0, 500), user.employeeCode],
  );
  revalidatePath("/stock-policy");
}

export async function addPolicy(formData: FormData): Promise<void> {
  const user = await admin();
  if (!user) return;
  const groupMain = String(formData.get("group_main") ?? "").trim();
  const brand = String(formData.get("brand") ?? "").trim().toUpperCase();
  const stockMonths = Number(formData.get("stock_months") ?? "2");
  if (!groupMain || !brand || !Number.isFinite(stockMonths) || stockMonths < 0 || stockMonths > 24) return;
  await pool.query(
    `INSERT INTO odg_stock_policy (group_main, brand, supplier_name, sale_months, stock_months, updated_by)
     VALUES ($1, $2, '', 1, $3, $4)
     ON CONFLICT (group_main, brand, supplier_name) DO UPDATE
        SET stock_months = EXCLUDED.stock_months, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [groupMain, brand.slice(0, 80), stockMonths, user.employeeCode],
  );
  revalidatePath("/stock-policy");
}

export async function deletePolicy(formData: FormData): Promise<void> {
  const user = await admin();
  if (!user) return;
  const id = Number(formData.get("id") ?? "");
  if (!id) return;
  await pool.query(`DELETE FROM odg_stock_policy WHERE id = $1`, [id]);
  revalidatePath("/stock-policy");
}
