"use server";

import { revalidatePath } from "next/cache";
import { pool } from "@/lib/db";
import { getIsAdmin } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";

export type GroupActionState = { error: string | null; success: string | null };

const PRODUCT_DEPTS = ["101", "102", "103", "104"];

async function requireAdmin(): Promise<{ employeeCode: string } | null> {
  const user = await getCurrentUser();
  if (!user || !(await getIsAdmin(user.employeeCode))) return null;
  return user;
}

export async function assignGroupResponsibility(
  _previous: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const user = await requireAdmin();
  if (!user) return { error: "ບໍ່ມີສິດ (ສະເພາະ admin)", success: null };

  const employeeCode = String(formData.get("employee_code") ?? "").trim();
  const groupMain = String(formData.get("group_main") ?? "").trim();
  const groupSub = String(formData.get("group_sub") ?? "").trim();
  if (!employeeCode || !groupMain) {
    return { error: "ກະລຸນາເລືອກ ພະນັກງານ ແລະ ກຸ່ມຫຼັກ", success: null };
  }

  const { rows } = await pool.query<{ fullname_lo: string }>(
    `SELECT fullname_lo FROM odg_employee
      WHERE employee_code = $1 AND department_code = ANY($2::varchar[])`,
    [employeeCode, PRODUCT_DEPTS],
  );
  if (!rows[0]) return { error: "ຕ້ອງເປັນພະນັກງານພະແນກພະລິດຕະພັນ", success: null };

  // A group can have multiple responsibles; skip if this exact pair exists.
  const res = await pool.query(
    `INSERT INTO odg_group_responsible (group_main, group_sub, employee_code, assigned_by, assigned_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (group_main, group_sub, employee_code) DO NOTHING`,
    [groupMain, groupSub, employeeCode, user.employeeCode],
  );
  revalidatePath("/staff");
  revalidatePath("/products");
  return res.rowCount
    ? { error: null, success: `ເພີ່ມກຸ່ມໃຫ້ ${rows[0].fullname_lo} ສຳເລັດ` }
    : { error: null, success: "ພະນັກງານນີ້ຮັບຜິດຊອບກຸ່ມນີ້ຢູ່ແລ້ວ" };
}

export async function removeGroupResponsibility(
  _previous: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const user = await requireAdmin();
  if (!user) return { error: "ບໍ່ມີສິດ (ສະເພາະ admin)", success: null };

  const id = Number(formData.get("id") ?? "");
  if (!id) return { error: "ຂໍ້ມູນບໍ່ຄົບ", success: null };

  const result = await pool.query(
    `DELETE FROM odg_group_responsible WHERE id = $1 RETURNING id`,
    [id],
  );
  if (!result.rowCount) return { error: "ບໍ່ພົບລາຍການ", success: null };
  revalidatePath("/staff");
  return { error: null, success: "ລຶບກຸ່ມທີ່ຮັບຜິດຊອບແລ້ວ" };
}
