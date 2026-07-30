import { type NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { canManageIncentives } from "@/lib/roles";

// Master list of point categories (app_incentive_pointmap_category) — the
// controlled vocabulary the Category Map's pointmap_category field draws from.
// See sql/add-incentive-pointmap-category.sql.

type Row = { code: string; label: string; sort_order: number; is_active: boolean };

async function list() {
  const { rows } = await pool.query<Row>(
    `SELECT code, label, sort_order, is_active
       FROM app_incentive_pointmap_category
      ORDER BY sort_order, code`,
  );
  return {
    categories: rows.map((r) => ({
      code: r.code,
      label: r.label,
      sortOrder: Number(r.sort_order ?? 0),
      isActive: r.is_active,
    })),
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await list());
  } catch {
    // Table not migrated — the editor shows an empty list / free-text fallback.
    return NextResponse.json({ categories: [] });
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !(await canManageIncentives(user))) {
    return NextResponse.json({ error: "ບໍ່ມີສິດແກ້ Config Incentive" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const code = String(body?.code ?? "").trim();
  const label = String(body?.label ?? "").trim() || code;
  const sortOrder = Number.isFinite(Number(body?.sortOrder)) ? Math.trunc(Number(body?.sortOrder)) : 0;
  if (!code) return NextResponse.json({ error: "ຕ້ອງໃສ່ລະຫັດໝວດ" }, { status: 400 });
  const exists = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::bigint AS n FROM app_incentive_pointmap_category WHERE code = $1`,
    [code],
  );
  if (Number(exists.rows[0]?.n ?? 0) > 0) {
    return NextResponse.json({ error: `ໝວດ ${code} ມີຢູ່ແລ້ວ` }, { status: 409 });
  }
  await pool.query(
    `INSERT INTO app_incentive_pointmap_category (code, label, sort_order, is_active)
     VALUES ($1, $2, $3, true)`,
    [code, label, sortOrder],
  );
  return NextResponse.json(await list());
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !(await canManageIncentives(user))) {
    return NextResponse.json({ error: "ບໍ່ມີສິດແກ້ Config Incentive" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const code = String(body?.code ?? "").trim();
  const label = String(body?.label ?? "").trim() || code;
  const sortOrder = Number.isFinite(Number(body?.sortOrder)) ? Math.trunc(Number(body?.sortOrder)) : 0;
  const isActive = body?.isActive === undefined ? true : Boolean(body?.isActive);
  if (!code) return NextResponse.json({ error: "ຕ້ອງໃສ່ລະຫັດໝວດ" }, { status: 400 });
  const updated = await pool.query(
    `UPDATE app_incentive_pointmap_category
        SET label = $1, sort_order = $2, is_active = $3
      WHERE code = $4`,
    [label, sortOrder, isActive, code],
  );
  if ((updated.rowCount ?? 0) === 0) return NextResponse.json({ error: "ບໍ່ພົບໝວດ" }, { status: 404 });
  return NextResponse.json(await list());
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !(await canManageIncentives(user))) {
    return NextResponse.json({ error: "ບໍ່ມີສິດແກ້ Config Incentive" }, { status: 403 });
  }
  const code = new URL(request.url).searchParams.get("code")?.trim();
  if (!code) return NextResponse.json({ error: "ບໍ່ໄດ້ລະບຸໝວດ" }, { status: 400 });
  // Block deletion while item categories still map to it — otherwise those rows
  // would point at a category that no longer exists.
  const inUse = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::bigint AS n FROM app_incentive_category WHERE TRIM(pointmap_category) = $1`,
    [code],
  );
  if (Number(inUse.rows[0]?.n ?? 0) > 0) {
    return NextResponse.json(
      { error: `ລຶບບໍ່ໄດ້ — ຍັງມີ ${Number(inUse.rows[0].n)} ໝວດສິນຄ້າໃຊ້ "${code}" ຢູ່` },
      { status: 409 },
    );
  }
  const removed = await pool.query(
    `DELETE FROM app_incentive_pointmap_category WHERE code = $1`,
    [code],
  );
  if ((removed.rowCount ?? 0) === 0) return NextResponse.json({ error: "ບໍ່ພົບໝວດ" }, { status: 404 });
  return NextResponse.json(await list());
}
