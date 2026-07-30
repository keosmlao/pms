"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getChannelPrices } from "@/lib/catalog";
import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export type CatalogState = { error: string | null; success: string | null };

async function auth() {
  return getCurrentUser();
}

export async function createCatalog(_prev: CatalogState, formData: FormData): Promise<CatalogState> {
  const user = await auth();
  if (!user) return { error: "ກະລຸນາເຂົ້າສູ່ລະບົບ", success: null };
  const title = String(formData.get("title") ?? "").trim();
  const currency = String(formData.get("currency_code") ?? "02") === "01" ? "01" : "02";
  if (!title) return { error: "ກະລຸນາໃສ່ຊື່ແຄັດຕາລ໊ອກ", success: null };
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO odg_pm_catalog (title, currency_code, created_by) VALUES ($1,$2,$3) RETURNING id`,
    [title.slice(0, 140), currency, user.employeeCode],
  );
  revalidatePath("/catalog");
  redirect(`/catalog/${rows[0].id}`);
}

export async function updateCatalogMeta(formData: FormData): Promise<void> {
  const user = await auth();
  if (!user) return;
  const id = Number(formData.get("id") ?? "");
  if (!id) return;
  const template = String(formData.get("template") ?? "grid");
  const accent = String(formData.get("accent") ?? "teal");
  const channel = String(formData.get("price_channel") ?? "retail");
  const okTemplate = ["grid", "list", "showcase", "pricelist"].includes(template) ? template : "grid";
  const okAccent = ["teal", "blue", "rose", "amber", "slate"].includes(accent) ? accent : "teal";
  const okChannel = channel === "wholesale" ? "wholesale" : "retail";
  await pool.query(
    `UPDATE odg_pm_catalog SET title=$2, subtitle=$3, currency_code=$4, columns=$5, show_price=$6, template=$7, accent=$8, price_channel=$9, updated_at=now() WHERE id=$1`,
    [
      id,
      String(formData.get("title") ?? "").trim().slice(0, 140) || "ແຄັດຕາລ໊ອກ",
      String(formData.get("subtitle") ?? "").trim().slice(0, 200),
      String(formData.get("currency_code") ?? "02") === "01" ? "01" : "02",
      Math.max(2, Math.min(4, Number(formData.get("columns") ?? "3") || 3)),
      formData.get("show_price") === "on",
      okTemplate,
      okAccent,
      okChannel,
    ],
  );
  revalidatePath(`/catalog/${id}`);
}

export async function deleteCatalog(formData: FormData): Promise<void> {
  const user = await auth();
  if (!user) return;
  const id = Number(formData.get("id") ?? "");
  if (!id) return;
  await pool.query(`DELETE FROM odg_pm_catalog WHERE id = $1`, [id]);
  revalidatePath("/catalog");
  redirect("/catalog");
}

// Re-pull every item's price from the catalog's selected sales channel.
export async function refreshCatalogPrices(formData: FormData): Promise<void> {
  const user = await auth();
  if (!user) return;
  const id = Number(formData.get("id") ?? "");
  if (!id) return;
  const cat = await pool.query<{ currency_code: string; price_channel: string }>(
    `SELECT currency_code, price_channel FROM odg_pm_catalog WHERE id = $1`,
    [id],
  );
  if (!cat.rowCount) return;
  const codesRes = await pool.query<{ item_code: string }>(
    `SELECT DISTINCT item_code FROM odg_pm_catalog_item WHERE catalog_id = $1 AND item_code <> ''`,
    [id],
  );
  const codes = codesRes.rows.map((r) => r.item_code);
  if (!codes.length) return;
  const prices = await getChannelPrices(codes, cat.rows[0].currency_code, cat.rows[0].price_channel);
  // Only overwrite items that have a matching channel price (> 0).
  for (const [code, price] of prices) {
    if (price > 0) await pool.query(`UPDATE odg_pm_catalog_item SET price = $2 WHERE catalog_id = $1 AND item_code = $3`, [id, price, code]);
  }
  revalidatePath(`/catalog/${id}`);
}

export type CatLine = { item_code: string; name: string; unit: string; price: number; spec: string };

export async function saveCatalogItems(catalogId: number, lines: CatLine[]): Promise<CatalogState> {
  const user = await auth();
  if (!user) return { error: "ກະລຸນາເຂົ້າສູ່ລະບົບ", success: null };
  if (!catalogId) return { error: "ຂໍ້ມູນບໍ່ຄົບ", success: null };
  const clean = lines
    .filter((l) => l.name?.trim())
    .map((l, i) => ({
      item_code: String(l.item_code ?? "").slice(0, 30),
      name: String(l.name).trim().slice(0, 200),
      unit: String(l.unit ?? "").slice(0, 40),
      price: Number.isFinite(l.price) && l.price >= 0 ? l.price : 0,
      spec: String(l.spec ?? "").trim().slice(0, 300),
      sort: i,
    }));

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM odg_pm_catalog_item WHERE catalog_id = $1`, [catalogId]);
    if (clean.length) {
      await client.query(
        `INSERT INTO odg_pm_catalog_item (catalog_id, item_code, name, unit, price, spec, sort)
         SELECT $1, t.item_code, t.name, t.unit, t.price, t.spec, t.sort
           FROM unnest($2::text[], $3::text[], $4::text[], $5::numeric[], $6::text[], $7::int[])
                AS t(item_code, name, unit, price, spec, sort)`,
        [catalogId, clean.map((c) => c.item_code), clean.map((c) => c.name), clean.map((c) => c.unit), clean.map((c) => c.price), clean.map((c) => c.spec), clean.map((c) => c.sort)],
      );
    }
    await client.query(`UPDATE odg_pm_catalog SET updated_at = now() WHERE id = $1`, [catalogId]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  revalidatePath(`/catalog/${catalogId}`);
  return { error: null, success: "ບັນທຶກແລ້ວ" };
}
