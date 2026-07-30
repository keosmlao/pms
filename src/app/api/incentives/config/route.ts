import { type NextRequest, NextResponse } from "next/server";
import { pool, withTx } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { canManageIncentives } from "@/lib/roles";

type ConfigRow = {
  base_amount: string | number;
  currency_code: string;
  low_max_pct: string | number;
  standard_max_pct: string | number;
  low_multiplier: string | number;
  standard_multiplier: string | number;
  high_multiplier: string | number;
  commission_base: string | number;
  updated_at: Date;
};

// Configurable commission-rate rule. Read separately (best-effort) so the
// settings page keeps working before sql/add-incentive-commission-rule.sql runs.
type RuleRow = {
  commission_min_pct: string | number;
  commission_round_step: string | number;
  commission_pivot_pct: string | number;
};
const DEFAULT_RULE = { commissionMinPct: 0.8, commissionRoundStep: 0.05, commissionPivotPct: 1 };

type TargetRow = {
  roworder: number;
  emp_code: string;
  display_name: string | null;
  year: string;
  month: string;
  product_group: string;
  target: string | number;
};

function output(config: ConfigRow, targets: TargetRow[], rule: RuleRow | undefined) {
  return {
    config: {
      baseAmount: Number(config.base_amount),
      currencyCode: config.currency_code,
      lowMaxPct: Number(config.low_max_pct),
      standardMaxPct: Number(config.standard_max_pct),
      lowMultiplier: Number(config.low_multiplier),
      standardMultiplier: Number(config.standard_multiplier),
      highMultiplier: Number(config.high_multiplier),
      commissionBase: Number(config.commission_base),
      commissionMinPct: rule?.commission_min_pct != null ? Number(rule.commission_min_pct) : DEFAULT_RULE.commissionMinPct,
      commissionRoundStep: rule?.commission_round_step != null ? Number(rule.commission_round_step) : DEFAULT_RULE.commissionRoundStep,
      commissionPivotPct: rule?.commission_pivot_pct != null ? Number(rule.commission_pivot_pct) : DEFAULT_RULE.commissionPivotPct,
      updatedAt: config.updated_at.toISOString(),
    },
    targets: targets.map((row) => ({
      rowOrder: row.roworder,
      employeeCode: row.emp_code,
      displayName: row.display_name ?? row.emp_code,
      year: Number(row.year),
      month: Number(row.month),
      groupCode: row.product_group,
      target: Number(row.target),
    })),
  };
}

async function readConfig() {
  const [configs, rules, targets] = await Promise.all([
    pool.query<ConfigRow>(
      `SELECT base_amount, currency_code, low_max_pct, standard_max_pct,
              low_multiplier, standard_multiplier, high_multiplier, commission_base, updated_at
         FROM app_incentive_config WHERE id = 1`,
    ),
    (async () => {
      try {
        const { rows } = await pool.query<RuleRow>(
          `SELECT commission_min_pct, commission_round_step, commission_pivot_pct
             FROM app_incentive_config WHERE id = 1`,
        );
        return rows;
      } catch {
        return [] as RuleRow[];
      }
    })(),
    pool.query<TargetRow>(
      `SELECT target.roworder, target.emp_code,
              COALESCE(NULLIF(employee.fullname_lo, ''), NULLIF(employee.nickname, ''), target.emp_code) AS display_name,
              target.year, target.month, target.product_group, target.target
         FROM odg_retail_target_employee target
         LEFT JOIN odg_employee employee ON employee.employee_code = target.emp_code
        ORDER BY target.year DESC, target.month DESC, target.product_group, display_name`,
    ),
  ]);
  return output(configs.rows[0], targets.rows, rules[0]);
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await readConfig());
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canManageIncentives(user))) {
    return NextResponse.json({ error: "ບໍ່ມີສິດແກ້ Config Incentive" }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as {
    config?: Record<string, unknown>;
    targets?: Array<Record<string, unknown>>;
  } | null;
  const config = body?.config ?? {};
  const base = Number(config.baseAmount);
  const lowMax = Number(config.lowMaxPct);
  const standardMax = Number(config.standardMaxPct);
  const lowMultiplier = Number(config.lowMultiplier);
  const standardMultiplier = Number(config.standardMultiplier);
  const highMultiplier = Number(config.highMultiplier);
  const commissionBase = Number(config.commissionBase);
  const commissionMinPct = Number(config.commissionMinPct);
  const commissionRoundStep = Number(config.commissionRoundStep);
  const commissionPivotPct = Number(config.commissionPivotPct);
  const currency = typeof config.currencyCode === "string"
    ? config.currencyCode.trim().toUpperCase().slice(0, 10)
    : "THB";

  if (![base, lowMax, standardMax, lowMultiplier, standardMultiplier, highMultiplier, commissionBase].every(Number.isFinite) ||
      base < 0 || lowMax <= 0 || standardMax < lowMax ||
      lowMultiplier < 0 || standardMultiplier < 0 || highMultiplier < 0 || commissionBase < 0 || !currency) {
    return NextResponse.json({ error: "ຄ່າ Config ບໍ່ຖືກຕ້ອງ" }, { status: 400 });
  }

  // Commission-rate rule: minimum ≥ 0, step in (0, 1], pivot ≥ minimum.
  if (![commissionMinPct, commissionRoundStep, commissionPivotPct].every(Number.isFinite) ||
      commissionMinPct < 0 || commissionMinPct > 5 ||
      commissionRoundStep <= 0 || commissionRoundStep > 1 ||
      commissionPivotPct < commissionMinPct || commissionPivotPct > 5) {
    return NextResponse.json({ error: "ຄ່າເກນຄ່າຄອມບໍ່ຖືກຕ້ອງ (ຕ່ຳສຸດ ≥ 0, ຂັ້ນປັດ 0–1, ຈຸດປັດ ≥ ຕ່ຳສຸດ)" }, { status: 400 });
  }

  const targets = (body?.targets ?? []).map((row) => ({
    rowOrder: Number(row.rowOrder),
    employeeCode: String(row.employeeCode ?? ""),
    year: Number(row.year),
    month: Number(row.month),
    groupCode: String(row.groupCode ?? ""),
    target: Number(row.target),
  }));
  const validTargets = targets.every((row) =>
    Number.isInteger(row.year) && row.year >= 2020 && row.year <= 2100 &&
    Number.isInteger(row.month) && row.month >= 1 && row.month <= 12 &&
    Number.isInteger(row.rowOrder) && row.rowOrder > 0 && row.employeeCode.length > 0 &&
    ["CE", "AC"].includes(row.groupCode) &&
    Number.isFinite(row.target) && row.target >= 0
  );
  if (!validTargets) return NextResponse.json({ error: "ຂໍ້ມູນເປົ້າລາຍເດືອນບໍ່ຖືກຕ້ອງ" }, { status: 400 });

  await withTx(async (client) => {
    await client.query(
      `UPDATE app_incentive_config SET
         base_amount = $1, currency_code = $2,
         low_max_pct = $3, standard_max_pct = $4,
         low_multiplier = $5, standard_multiplier = $6,
         high_multiplier = $7, commission_base = $8,
         commission_min_pct = $9, commission_round_step = $10,
         commission_pivot_pct = $11, updated_at = now()
       WHERE id = 1`,
      [base, currency, lowMax, standardMax, lowMultiplier, standardMultiplier,
       highMultiplier, commissionBase, commissionMinPct, commissionRoundStep, commissionPivotPct],
    );
    for (const row of targets) {
      await client.query(
        `UPDATE odg_retail_target_employee
            SET target = $1
          WHERE roworder = $2
            AND emp_code = $3`,
        [row.target, row.rowOrder, row.employeeCode],
      );
    }
  });
  return NextResponse.json(await readConfig());
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canManageIncentives(user))) {
    return NextResponse.json({ error: "ບໍ່ມີສິດເພີ່ມ Target" }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const employeeCode = String(body?.employeeCode ?? "").trim();
  const year = Number(body?.year);
  const month = Number(body?.month);
  const groupCode = String(body?.groupCode ?? "").trim().toUpperCase();
  const target = Number(body?.target);
  if (!employeeCode || !Number.isInteger(year) || year < 2020 || year > 2100 ||
      !Number.isInteger(month) || month < 1 || month > 12 ||
      !["CE", "AC"].includes(groupCode) || !Number.isFinite(target) || target < 0) {
    return NextResponse.json({ error: "ຂໍ້ມູນ Target ບໍ່ຖືກຕ້ອງ" }, { status: 400 });
  }
  const exists = await pool.query<{ roworder: number }>(
    `SELECT roworder FROM odg_retail_target_employee
      WHERE emp_code = $1
        AND year = $2
        AND LPAD(month, 2, '0') = LPAD($3, 2, '0')
        AND product_group = $4
      LIMIT 1`,
    [employeeCode, year.toString(), month.toString(), groupCode],
  );
  if (exists.rows.length > 0) {
    return NextResponse.json({ error: "Target ຂອງພະນັກງານ/ເດືອນ/ກຸ່ມນີ້ມີແລ້ວ" }, { status: 409 });
  }
  const found = await pool.query<{ employee_code: string }>(
    `SELECT employee_code FROM odg_employee WHERE employee_code = $1 LIMIT 1`,
    [employeeCode],
  );
  if (found.rows.length === 0) {
    return NextResponse.json({ error: "ບໍ່ພົບລະຫັດພະນັກງານ" }, { status: 404 });
  }
  await pool.query(
    `INSERT INTO odg_retail_target_employee (emp_code, target, year, month, product_group)
     VALUES ($1, $2, $3, $4, $5)`,
    [employeeCode, target, year.toString(), month.toString().padStart(2, "0"), groupCode],
  );
  return NextResponse.json(await readConfig(), { status: 201 });
}
