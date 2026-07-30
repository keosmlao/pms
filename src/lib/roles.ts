// Incentive-config permission roles. Ported from web_sale_order's src/lib/roles.ts
// but sourced from the session user + odg_employee via `pool` instead of Prisma.
//
// Effective role is derived from odg_position.position_code, with
// odg_employee.app_role acting as an explicit per-user override, and
// app_employee_access providing a further active override (matching the source
// app's applyAccessOverride behaviour).
//
//   position_code 11 → manager
//   position_code 12 → head
//   position_code 13 → salesperson
//
// app_role overrides the position mapping when it is one of the valid roles.
import { pool } from "@/lib/db";
import { getIsAdmin } from "@/lib/products";
import type { SessionUser } from "@/lib/auth-token";

export type AppRole = "pc" | "salesperson" | "head" | "manager";

const VALID_ROLES: readonly AppRole[] = ["pc", "salesperson", "head", "manager"] as const;

export function isValidRole(raw: unknown): raw is AppRole {
  return typeof raw === "string" && (VALID_ROLES as readonly string[]).includes(raw);
}

export function roleFromPositionCode(positionCode: string | null | undefined): AppRole {
  switch ((positionCode ?? "").trim()) {
    case "11":
      return "manager";
    case "12":
      return "head";
    case "13":
      return "salesperson";
    default:
      return "salesperson";
  }
}

// Pure derivation — app_role wins when valid, else fall back to position.
export function roleFromEmployee(emp: {
  appRole: string | null | undefined;
  positionCode: string | null | undefined;
}): AppRole {
  if (emp.appRole && isValidRole(emp.appRole.trim())) {
    return emp.appRole.trim() as AppRole;
  }
  return roleFromPositionCode(emp.positionCode);
}

// Resolve the effective role for a logged-in session user. Reads the current
// app_role / position_code from odg_employee, honouring an active
// app_employee_access override, then applies roleFromEmployee. Falls back to the
// session's own role string if the employee row cannot be read.
export async function resolveAppRole(
  user: Pick<SessionUser, "employeeCode" | "role">,
): Promise<AppRole> {
  try {
    const { rows } = await pool.query<{ app_role: string | null; position_code: string | null }>(
      `SELECT COALESCE(a.app_role, e.app_role)           AS app_role,
              COALESCE(a.position_code, e.position_code) AS position_code
         FROM odg_employee e
         LEFT JOIN app_employee_access a
                ON a.employee_code = e.employee_code
               AND a.is_active = true
        WHERE e.employee_code = $1
        LIMIT 1`,
      [user.employeeCode],
    );
    const row = rows[0];
    if (row) return roleFromEmployee({ appRole: row.app_role, positionCode: row.position_code });
  } catch {
    // odg_employee unreadable — fall through to the session role.
  }
  return isValidRole((user.role ?? "").trim()) ? ((user.role as string).trim() as AppRole) : "salesperson";
}

// Single source of truth for "may this user edit incentive configuration?".
// Managers and unit heads can manage (matching web_sale_order); in the Product
// Management app, admins (IT dept / app_role='admin') can manage too so the
// config owners are not locked out. Everyone else is read-only.
export async function canManageIncentives(
  user: Pick<SessionUser, "employeeCode" | "role">,
): Promise<boolean> {
  const [role, admin] = await Promise.all([
    resolveAppRole(user),
    getIsAdmin(user.employeeCode).catch(() => false),
  ]);
  return admin || role === "manager" || role === "head";
}
