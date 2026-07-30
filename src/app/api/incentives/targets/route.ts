import { type NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { canManageIncentives } from "@/lib/roles";

// Monthly sales-target pivot (odg_retail_target_employee): every ACTIVE
// storefront SELLER (position 13 — bonuses/targets apply to sellers only)
// gets an editable CE / AC target per month.
//
// Scoped to the Khua Luang storefront only (205 · ພະແນກຂາຍໜ້າຮ້ານຂົວຫຼວງ).
// Excluded: 204 (ຂາຍສົ່ງອາໄຫຼ່ — parts) and 207 (ອອນລາຍ — online) don't carry
// these CE/AC storefront targets.
const SELLER_DEPTS = ["205"];
const GROUPS = ["CE", "AC"] as const;

function parsePeriod(url: URL): { year: number; month: number } | null {
  const year = Number(url.searchParams.get("year"));
  const month = Number(url.searchParams.get("month"));
  if (!Number.isInteger(year) || year < 2020 || year > 2100) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  return { year, month };
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const period = parsePeriod(new URL(request.url));
  if (!period) return NextResponse.json({ error: "year/month ບໍ່ຖືກຕ້ອງ" }, { status: 400 });

  const [employees, targets] = await Promise.all([
    pool.query<{
      employee_code: string;
      fullname_lo: string | null;
      nickname: string | null;
      department_code: string | null;
    }>(
      `SELECT employee_code, fullname_lo, nickname, department_code
         FROM odg_employee
        WHERE position_code = '13'
          AND department_code = ANY($1::text[])
          AND COALESCE(employment_status, 'ACTIVE') = 'ACTIVE'
        ORDER BY department_code, employee_code`,
      [SELLER_DEPTS],
    ),
    pool.query<{
      emp_code: string;
      product_group: string;
      target: string | number | null;
    }>(
      `SELECT DISTINCT ON (emp_code, product_group) emp_code, product_group, target
         FROM odg_retail_target_employee
        WHERE year = $1
          AND LPAD(month, 2, '0') = $2
        ORDER BY emp_code, product_group, roworder DESC`,
      [period.year.toString(), period.month.toString().padStart(2, "0")],
    ),
  ]);

  return NextResponse.json({
    year: period.year,
    month: period.month,
    employees: employees.rows.map((e) => ({
      code: e.employee_code,
      name: e.fullname_lo?.trim() || e.nickname?.trim() || e.employee_code,
      dept: e.department_code ?? "",
    })),
    targets: targets.rows.map((t) => ({
      employeeCode: t.emp_code?.trim(),
      groupCode: t.product_group?.trim(),
      target: Number(t.target ?? 0),
    })),
  });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canManageIncentives(user))) {
    return NextResponse.json({ error: "ບໍ່ມີສິດແກ້ Target" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    year?: number;
    month?: number;
    entries?: Array<{ employeeCode?: string; groupCode?: string; target?: number | null }>;
  } | null;
  const year = Number(body?.year);
  const month = Number(body?.month);
  if (!Number.isInteger(year) || year < 2020 || year > 2100 ||
      !Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "year/month ບໍ່ຖືກຕ້ອງ" }, { status: 400 });
  }
  const entries = (body?.entries ?? []).filter(
    (e) =>
      typeof e.employeeCode === "string" && e.employeeCode.trim() &&
      GROUPS.includes((e.groupCode ?? "") as (typeof GROUPS)[number]) &&
      (e.target === null || (Number.isFinite(Number(e.target)) && Number(e.target) >= 0)),
  );
  if (entries.length === 0) {
    return NextResponse.json({ error: "ບໍ່ມີຂໍ້ມູນທີ່ຖືກຕ້ອງ" }, { status: 400 });
  }

  const mm = month.toString().padStart(2, "0");
  // Replace-style upsert per (employee, group, month): clears duplicates from
  // repeated legacy inserts, then writes the new value (blank/0 = no target).
  for (const e of entries) {
    const code = e.employeeCode!.trim();
    const group = e.groupCode!;
    await pool.query(
      `DELETE FROM odg_retail_target_employee
        WHERE emp_code = $1
          AND year = $2
          AND LPAD(month, 2, '0') = $3
          AND product_group = $4`,
      [code, year.toString(), mm, group],
    );
    const target = Number(e.target ?? 0);
    if (target > 0) {
      await pool.query(
        `INSERT INTO odg_retail_target_employee (emp_code, target, year, month, product_group)
         VALUES ($1, $2, $3, $4, $5)`,
        [code, target, year.toString(), mm, group],
      );
    }
  }
  return NextResponse.json({ ok: true, saved: entries.length });
}
