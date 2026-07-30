import { type NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { canManageIncentives } from "@/lib/roles";

// Product-category master (app_incentive_category): maps each item category_code
// to a bonus point group (pointmap_category: AV/Air/REF/SDA/Washer …) and the
// commission group_code (CE_SDA / AIR, enforced by a CHECK constraint).

type CategoryRow = {
  category_code: string;
  category_name: string | null;
  pointmap_category: string | null;
  group_code: string;
  weight: string | number;
  sda_subtype: string | null;
  is_active: boolean;
};

// group_code is CHECK-constrained in the DB to exactly these two.
const GROUP_CODES: readonly string[] = ["CE_SDA", "AIR"];

async function listCategories() {
  const { rows } = await pool.query<CategoryRow>(
    `SELECT category_code, category_name, pointmap_category, group_code,
            weight, sda_subtype, is_active
       FROM app_incentive_category
      ORDER BY category_code`,
  );
  return {
    categories: rows.map((r) => ({
      categoryCode: r.category_code,
      categoryName: r.category_name ?? "",
      pointmapCategory: r.pointmap_category ?? "",
      groupCode: r.group_code,
      weight: Number(r.weight ?? 0),
      sdaSubtype: r.sda_subtype ?? "",
      isActive: r.is_active,
    })),
  };
}

function parseBody(body: Record<string, unknown> | null) {
  return {
    categoryCode: String(body?.categoryCode ?? "").trim(),
    categoryName: String(body?.categoryName ?? "").trim(),
    pointmapCategory: String(body?.pointmapCategory ?? "").trim() || null,
    groupCode: String(body?.groupCode ?? "").trim().toUpperCase(),
    weight: Number(body?.weight),
    sdaSubtype: String(body?.sdaSubtype ?? "").trim().toUpperCase() || null,
    isActive: body?.isActive === undefined ? true : Boolean(body?.isActive),
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await listCategories());
  } catch {
    return NextResponse.json({ error: "app_incentive_category ຍັງບໍ່ມີ" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !(await canManageIncentives(user))) {
    return NextResponse.json({ error: "ບໍ່ມີສິດແກ້ Config Incentive" }, { status: 403 });
  }
  const c = parseBody((await request.json().catch(() => null)) as Record<string, unknown> | null);
  if (!c.categoryCode || !GROUP_CODES.includes(c.groupCode) || !Number.isFinite(c.weight) || c.weight < 0) {
    return NextResponse.json(
      { error: "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ — ຕ້ອງມີລະຫັດໝວດ, group (CE_SDA/AIR) ແລະ ນ້ຳໜັກ ≥ 0" },
      { status: 400 },
    );
  }
  const exists = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::bigint AS n FROM app_incentive_category WHERE category_code = $1`,
    [c.categoryCode],
  );
  if (Number(exists.rows[0]?.n ?? 0) > 0) {
    return NextResponse.json({ error: `ລະຫັດໝວດ ${c.categoryCode} ມີຢູ່ແລ້ວ` }, { status: 409 });
  }
  await pool.query(
    `INSERT INTO app_incentive_category
       (category_code, category_name, pointmap_category, group_code, weight, sda_subtype, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [c.categoryCode, c.categoryName, c.pointmapCategory, c.groupCode, c.weight, c.sdaSubtype, c.isActive],
  );
  return NextResponse.json(await listCategories());
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !(await canManageIncentives(user))) {
    return NextResponse.json({ error: "ບໍ່ມີສິດແກ້ Config Incentive" }, { status: 403 });
  }
  const c = parseBody((await request.json().catch(() => null)) as Record<string, unknown> | null);
  if (!c.categoryCode || !GROUP_CODES.includes(c.groupCode) || !Number.isFinite(c.weight) || c.weight < 0) {
    return NextResponse.json(
      { error: "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ — group ຕ້ອງເປັນ CE_SDA/AIR ແລະ ນ້ຳໜັກ ≥ 0" },
      { status: 400 },
    );
  }
  const updated = await pool.query(
    `UPDATE app_incentive_category
        SET category_name = $1,
            pointmap_category = $2,
            group_code = $3,
            weight = $4,
            sda_subtype = $5,
            is_active = $6
      WHERE category_code = $7`,
    [c.categoryName, c.pointmapCategory, c.groupCode, c.weight, c.sdaSubtype, c.isActive, c.categoryCode],
  );
  if ((updated.rowCount ?? 0) === 0) return NextResponse.json({ error: "ບໍ່ພົບໝວດ" }, { status: 404 });
  return NextResponse.json(await listCategories());
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !(await canManageIncentives(user))) {
    return NextResponse.json({ error: "ບໍ່ມີສິດແກ້ Config Incentive" }, { status: 403 });
  }
  const code = new URL(request.url).searchParams.get("code")?.trim();
  if (!code) return NextResponse.json({ error: "ບໍ່ໄດ້ລະບຸໝວດ" }, { status: 400 });
  const removed = await pool.query(
    `DELETE FROM app_incentive_category WHERE category_code = $1`,
    [code],
  );
  if ((removed.rowCount ?? 0) === 0) return NextResponse.json({ error: "ບໍ່ພົບໝວດ" }, { status: 404 });
  return NextResponse.json(await listCategories());
}
