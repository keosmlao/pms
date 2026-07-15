"use server";

import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createSessionToken } from "@/lib/auth-token";
import { setSessionCookie } from "@/lib/session";

export type LoginState = { error: string | null };

type EmployeeRow = {
  employee_id: number;
  employee_code: string;
  fullname_lo: string;
  password: string | null;
  app_role: string | null;
  employment_status: string | null;
};

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const employeeCode = String(formData.get("employee_code") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!employeeCode || !password) {
    return { error: "ກະລຸນາປ້ອນລະຫັດພະນັກງານ ແລະ ລະຫັດຜ່ານ" };
  }

  const { rows } = await pool.query<EmployeeRow>(
    `SELECT employee_id, employee_code, fullname_lo, password, app_role, employment_status
       FROM odg_employee
      WHERE employee_code = $1`,
    [employeeCode],
  );

  const employee = rows[0];
  const invalid = { error: "ລະຫັດພະນັກງານ ຫຼື ລະຫັດຜ່ານ ບໍ່ຖືກຕ້ອງ" };

  if (!employee || !verifyPassword(password, employee.password)) return invalid;
  if (employee.employment_status !== "ACTIVE") {
    return { error: "ບັນຊີນີ້ຖືກປິດການໃຊ້ງານແລ້ວ" };
  }

  const token = await createSessionToken({
    employeeId: employee.employee_id,
    employeeCode: employee.employee_code,
    fullname: employee.fullname_lo,
    role: employee.app_role,
  });
  await setSessionCookie(token);

  redirect("/home");
}
