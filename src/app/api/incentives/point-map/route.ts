import { type NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { canManageIncentives } from "@/lib/roles";

// int8 id comes back from node-postgres as a string.
type RuleRow = { id: string; category_code: string; brand_code: string; design_token: string; size_token: string; effective_from: string; effective_to: string; points: string | number; is_special: boolean };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function listOptions() {
  const pick = async (sql: string): Promise<string[]> => {
    try {
      const { rows } = await pool.query<{ v: string | null }>(sql);
      return [...new Set(rows.map((row) => (row.v ?? "").trim()).filter(Boolean))];
    } catch {
      return [];
    }
  };
  const [categories, brands, designTokens, sizeTokens] = await Promise.all([
    pick(`SELECT DISTINCT pointmap_category AS v FROM app_incentive_category WHERE COALESCE(pointmap_category, '') <> '' ORDER BY 1`),
    pick(`SELECT DISTINCT brand_code AS v FROM app_incentive_point_rule ORDER BY 1`),
    pick(`SELECT DISTINCT design_token AS v FROM app_incentive_design_token WHERE COALESCE(design_token, '') <> '' ORDER BY 1`),
    pick(`SELECT DISTINCT size_token AS v FROM app_incentive_size_token WHERE COALESCE(size_token, '') <> '' ORDER BY 1`),
  ]);
  return { categories, brands, designTokens, sizeTokens };
}

async function listRows(year = 0, month = 0) {
  const { rows } = await pool.query<RuleRow>(
    `SELECT id, category_code, brand_code, design_token, size_token, effective_from::text, effective_to::text, points, is_special FROM app_incentive_point_rule WHERE ($1 = 0 OR $2 = 0 OR (effective_from < make_date($1, $2, 1) + INTERVAL '1 month' AND effective_to >= make_date($1, $2, 1))) ORDER BY is_special DESC, effective_from DESC, category_code, brand_code`,
    [year, month],
  );
  const options = await listOptions();
  return { categories: options.categories, options, rows: rows.map((row) => ({ id: row.id.toString(), categoryCode: row.category_code, brandCode: row.brand_code, designToken: row.design_token, sizeToken: row.size_token, effectiveFrom: row.effective_from, effectiveTo: row.effective_to, points: Number(row.points), isSpecial: row.is_special })) };
}

function parse(body: Record<string, unknown> | null) {
  const id = String(body?.id ?? "");
  const categoryCode = String(body?.categoryCode ?? "").trim();
  const brandCode = String(body?.brandCode ?? "").trim().toUpperCase();
  const designToken = String(body?.designToken ?? "").trim();
  const sizeToken = String(body?.sizeToken ?? "").trim();
  const effectiveFrom = String(body?.effectiveFrom ?? "");
  const isSpecial = Boolean(body?.isSpecial);
  const effectiveTo = isSpecial ? effectiveFrom : String(body?.effectiveTo ?? "");
  const points = Number(body?.points);
  const valid = categoryCode.length > 0 && categoryCode.length <= 10 && brandCode.length > 0 && brandCode.length <= 50 && designToken.length <= 40 && sizeToken.length <= 40 && DATE_RE.test(effectiveFrom) && DATE_RE.test(effectiveTo) && effectiveTo >= effectiveFrom && Number.isFinite(points) && points >= 0;
  return { id, categoryCode, brandCode, designToken, sizeToken, effectiveFrom, effectiveTo, points, isSpecial, valid };
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  try { return NextResponse.json(await listRows(Number(url.searchParams.get("year")), Number(url.searchParams.get("month")))); } catch { return NextResponse.json({ error: "Run sql/add-pointmap-date-ranges.sql first" }, { status: 503 }); }
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !(await canManageIncentives(user))) return NextResponse.json({ error: "ບໍ່ມີສິດແກ້ຄະແນນໂບນັດ" }, { status: 403 });
  const rule = parse(await request.json().catch(() => null));
  if (!rule.valid) return NextResponse.json({ error: "ຂໍ້ມູນຄະແນນ/ວັນທີບໍ່ຖືກຕ້ອງ" }, { status: 400 });
  if (rule.id) {
    await pool.query(
      `UPDATE app_incentive_point_rule SET category_code = $1, brand_code = $2, design_token = $3, size_token = $4, effective_from = $5::date, effective_to = $6::date, points = $7, is_special = $8, updated_at = now() WHERE id = $9::bigint`,
      [rule.categoryCode, rule.brandCode, rule.designToken, rule.sizeToken, rule.effectiveFrom, rule.effectiveTo, rule.points, rule.isSpecial, rule.id],
    );
  } else {
    await pool.query(
      `INSERT INTO app_incentive_point_rule (category_code, brand_code, design_token, size_token, effective_from, effective_to, points, is_special) VALUES ($1, $2, $3, $4, $5::date, $6::date, $7, $8) ON CONFLICT (category_code, brand_code, design_token, size_token, effective_from, effective_to, is_special) DO UPDATE SET points = EXCLUDED.points, updated_at = now()`,
      [rule.categoryCode, rule.brandCode, rule.designToken, rule.sizeToken, rule.effectiveFrom, rule.effectiveTo, rule.points, rule.isSpecial],
    );
  }
  return NextResponse.json(await listRows());
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !(await canManageIncentives(user))) return NextResponse.json({ error: "ບໍ່ມີສິດລຶບຄະແນນໂບນັດ" }, { status: 403 });
  const id = String((await request.json().catch(() => null) as { id?: unknown } | null)?.id ?? "");
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "ID ບໍ່ຖືກຕ້ອງ" }, { status: 400 });
  await pool.query(`DELETE FROM app_incentive_point_rule WHERE id = $1::bigint`, [id]);
  return NextResponse.json(await listRows());
}
