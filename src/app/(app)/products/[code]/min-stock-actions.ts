"use server";

import { revalidatePath } from "next/cache";
import { pool } from "@/lib/db";
import { getIsAdmin } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";

export type MinStockState = { error: string | null; success: string | null };

// Upsert without relying on a unique constraint (DDL is restricted on the
// shared ERP DB): update first, insert if nothing was updated.
export async function setMinStock(
  _previous: MinStockState,
  formData: FormData,
): Promise<MinStockState> {
  const user = await getCurrentUser();
  if (!user || !(await getIsAdmin(user.employeeCode))) {
    return { error: "ບໍ່ມີສິດ (ສະເພາະ admin)", success: null };
  }

  const itemCode = String(formData.get("item_code") ?? "").trim();
  const raw = String(formData.get("min_qty") ?? "").trim();
  if (!itemCode) return { error: "ຂໍ້ມູນບໍ່ຄົບ", success: null };

  // Empty → remove the setting.
  if (raw === "") {
    await pool.query(`DELETE FROM odg_min_stock_setting WHERE item_code = $1`, [itemCode]);
    revalidatePath(`/products/${encodeURIComponent(itemCode)}`);
    return { error: null, success: "ລຶບ min stock ແລ້ວ" };
  }

  const minQty = Number(raw);
  if (Number.isNaN(minQty) || minQty < 0) {
    return { error: "ຈຳນວນບໍ່ຖືກຕ້ອງ", success: null };
  }

  const upd = await pool.query(
    `UPDATE odg_min_stock_setting
        SET min_qty = $2, updated_by = $3, updated_at = now()
      WHERE item_code = $1`,
    [itemCode, minQty, user.employeeCode],
  );
  if (!upd.rowCount) {
    await pool.query(
      `INSERT INTO odg_min_stock_setting (item_code, min_qty, updated_by, updated_at)
       VALUES ($1, $2, $3, now())`,
      [itemCode, minQty, user.employeeCode],
    );
  }
  revalidatePath(`/products/${encodeURIComponent(itemCode)}`);
  return { error: null, success: `ຕັ້ງ min stock = ${minQty.toLocaleString("en-US")}` };
}
