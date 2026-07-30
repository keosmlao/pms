import { type NextRequest, NextResponse } from "next/server";
import { pool, withTx } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { canManageIncentives } from "@/lib/roles";

// Commission bases for manager (position 11) / unit head (position 12), per
// product group — see sql/add-incentive-role-commission.sql. Paid on the
// TEAM's achievement of each group with the same 5%-step rate rule.

const POSITIONS = ["11", "12", "13"] as const;
const GROUPS = ["CE_SDA", "AIR", "ALL", "ONLINE"] as const;

type Line = { positionCode: string; groupCode: string; baseAmount: number };
// int8 columns (id) come back from node-postgres as strings.
type AuditRow = {
  id: string;
  position_code: string;
  group_code: string;
  old_amount: string | number;
  new_amount: string | number;
  changed_by: string | null;
  changed_by_name: string | null;
  changed_at: Date;
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { rows } = await pool.query<{
      position_code: string;
      group_code: string;
      base_amount: string | number | null;
    }>(
      `SELECT position_code, group_code, base_amount
         FROM app_incentive_role_commission`,
    );
    let history: AuditRow[] = [];
    let auditAvailable = true;
    try {
      const audit = await pool.query<AuditRow>(
        `SELECT audit.id, audit.position_code, audit.group_code,
                audit.old_amount, audit.new_amount, audit.changed_by,
                COALESCE(NULLIF(employee.fullname_lo, ''), NULLIF(employee.nickname, ''), audit.changed_by) AS changed_by_name,
                audit.changed_at
           FROM app_incentive_role_commission_audit audit
           LEFT JOIN odg_employee employee ON employee.employee_code = audit.changed_by
          ORDER BY audit.changed_at DESC, audit.id DESC
          LIMIT 100`,
      );
      history = audit.rows;
    } catch {
      auditAvailable = false;
    }
    return NextResponse.json({
      lines: rows.map((r) => ({
        positionCode: r.position_code,
        groupCode: r.group_code,
        baseAmount: Number(r.base_amount ?? 0),
      })),
      auditAvailable,
      history: history.map((row) => ({
        id: row.id.toString(),
        positionCode: row.position_code,
        groupCode: row.group_code,
        oldAmount: Number(row.old_amount),
        newAmount: Number(row.new_amount),
        changedBy: row.changed_by,
        changedByName: row.changed_by_name,
        changedAt: row.changed_at.toISOString(),
      })),
    });
  } catch {
    // Table not migrated yet.
    return NextResponse.json({ lines: null });
  }
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canManageIncentives(user))) {
    return NextResponse.json({ error: "ບໍ່ມີສິດແກ້ Config Incentive" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { lines?: Line[] } | null;
  const lines = (body?.lines ?? []).filter(
    (l) =>
      POSITIONS.includes(l.positionCode as (typeof POSITIONS)[number]) &&
      GROUPS.includes(l.groupCode as (typeof GROUPS)[number]) &&
      Number.isFinite(Number(l.baseAmount)) &&
      Number(l.baseAmount) >= 0,
  );
  if (lines.length === 0) {
    return NextResponse.json({ error: "ບໍ່ມີຂໍ້ມູນທີ່ຖືກຕ້ອງ" }, { status: 400 });
  }

  try {
    const changedBy = user.employeeCode?.trim() || null;
    await withTx(async (client) => {
      for (const line of lines) {
        const current = await client.query<{ base_amount: string | number }>(
          `SELECT base_amount FROM app_incentive_role_commission
            WHERE position_code = $1 AND group_code = $2
            FOR UPDATE`,
          [line.positionCode, line.groupCode],
        );
        const oldAmount = Number(current.rows[0]?.base_amount ?? 0);
        const newAmount = Number(line.baseAmount);
        if (oldAmount === newAmount) continue;

        await client.query(
          `INSERT INTO app_incentive_role_commission_audit
             (position_code, group_code, old_amount, new_amount, changed_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [line.positionCode, line.groupCode, oldAmount, newAmount, changedBy],
        );
        await client.query(
          `INSERT INTO app_incentive_role_commission (position_code, group_code, base_amount)
           VALUES ($1, $2, $3)
           ON CONFLICT (position_code, group_code)
           DO UPDATE SET base_amount = EXCLUDED.base_amount`,
          [line.positionCode, line.groupCode, newAmount],
        );
      }
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "ຕາຕະລາງປະຫວັດຍັງບໍ່ຖືກສ້າງ — ຮັນ sql/add-incentive-role-commission-audit.sql ກ່ອນ" },
      { status: 503 },
    );
  }
}
