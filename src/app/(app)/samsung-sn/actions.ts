"use server";

import { revalidatePath } from "next/cache";
import { pool } from "@/lib/db";
import { getIsAdmin } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";

export type ClaimState = { error: string | null; success: string | null };

export async function markSamsungClaim(_previous: ClaimState, formData: FormData): Promise<ClaimState> {
  const user = await getCurrentUser();
  if (!user || !(await getIsAdmin(user.employeeCode))) {
    return { error: "ບໍ່ມີສິດບັນທຶກການເຄມ", success: null };
  }

  const serialNo = String(formData.get("serial_no") ?? "").trim();
  const note = String(formData.get("claim_note") ?? "").trim();
  if (!serialNo) return { error: "ບໍ່ພົບ SN", success: null };
  if (!note) return { error: "ກະລຸນາໃສ່ໝາຍເຫດເຄມ", success: null };

  const result = await pool.query(
    `UPDATE wms_samsung_serial
        SET claim_note = $1
      WHERE TRIM(serial_no) = $2`,
    [note.slice(0, 500), serialNo],
  );
  if (!result.rowCount) return { error: "ບໍ່ພົບ SN ໃນຂໍ້ມູນ SAMSUNG", success: null };

  revalidatePath("/samsung-sn");
  return { error: null, success: "ບັນທຶກເຄມແລ້ວ" };
}
