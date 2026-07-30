import { pool } from "@/lib/db";

export const CATALOG_CURRENCIES: Record<string, { label: string; symbol: string }> = {
  "02": { label: "ກີບ (LAK)", symbol: "₭" },
  "01": { label: "ບາດ (THB)", symbol: "฿" },
};

export const CATALOG_CHANNELS: { code: string; label: string }[] = [
  { code: "retail", label: "ໜ້າຮ້ານ (Walk-in)" },
  { code: "wholesale", label: "ຂາຍສົ່ງ" },
];

// SQL expression (correlated to alias `i`) computing the channel price in the
// requested currency, falling back to the other currency. Retail = cust_group_2
// 10101; wholesale = 10201 × (1 − discount%) mirroring the products page.
function channelPriceExpr(channel: string, curParam: string, otherParam: string): string {
  if (channel === "wholesale") {
    const disc = (cur: string) => `
      (SELECT p.sale_price1 FROM ic_inventory_price p
        WHERE p.ic_code = i.code AND p.cust_group_2 = '10201'
          AND CURRENT_DATE BETWEEN p.from_date AND p.to_date AND p.currency_code = ${cur}
        ORDER BY p.from_date DESC LIMIT 1)
      * COALESCE((SELECT (100 - left(d.discount::text, length(d.discount::text) - 1)::numeric) / 100
           FROM ic_inventory_discount d
          WHERE d.ic_code = i.code AND d.cust_group_2 = '10201'
            AND CURRENT_DATE BETWEEN d.from_date AND d.to_date AND d.currency_code = ${cur}
          ORDER BY d.from_date DESC LIMIT 1), 1)`;
    return `COALESCE(${disc(curParam)}, ${disc(otherParam)})`;
  }
  const base = (cur: string) => `
    (SELECT p.sale_price1 FROM ic_inventory_price p
      WHERE p.ic_code = i.code AND p.cust_group_2 = '10101'
        AND CURRENT_DATE BETWEEN p.from_date AND p.to_date AND p.currency_code = ${cur}
      ORDER BY p.from_date DESC LIMIT 1)`;
  return `COALESCE(${base(curParam)}, ${base(otherParam)})`;
}

// Product search returning the selected channel's price. Used by the catalog
// builder's item picker.
export async function searchCatalogItems(
  q: string,
  currency: string,
  channel = "retail",
  limit = 20,
): Promise<{ code: string; name: string; unit: string; price: number }[]> {
  const term = q.trim();
  if (!term) return [];
  const other = currency === "02" ? "01" : "02";
  const priceExpr = channelPriceExpr(channel === "wholesale" ? "wholesale" : "retail", "$2", "$3");
  const { rows } = await pool.query<{ code: string; name: string; unit: string; price: string | null }>(
    `SELECT i.code, i.name_1 AS name,
            COALESCE(NULLIF(i.unit_standard_name,''), i.unit_standard, '') AS unit,
            (${priceExpr})::text AS price
       FROM ic_inventory i
      WHERE (i.code ILIKE $1 OR i.name_1 ILIKE $1 OR i.name_eng_1 ILIKE $1)
      ORDER BY i.code
      LIMIT ${Math.min(limit, 30)}`,
    [`%${term}%`, currency, other],
  );
  return rows.map((r) => ({ code: r.code, name: r.name, unit: r.unit, price: Number(r.price) || 0 }));
}

// Channel prices for a set of item codes (for "refresh prices from channel").
export async function getChannelPrices(
  codes: string[],
  currency: string,
  channel: string,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!codes.length) return map;
  const other = currency === "02" ? "01" : "02";
  const priceExpr = channelPriceExpr(channel === "wholesale" ? "wholesale" : "retail", "$2", "$3");
  const { rows } = await pool.query<{ code: string; price: string | null }>(
    `SELECT i.code, (${priceExpr})::text AS price
       FROM ic_inventory i
      WHERE i.code = ANY($1)`,
    [codes, currency, other],
  );
  for (const r of rows) map.set(r.code, Number(r.price) || 0);
  return map;
}

export type Catalog = {
  id: number;
  title: string;
  subtitle: string;
  currency_code: string;
  columns: number;
  show_price: boolean;
  template: string; // grid | list | showcase | pricelist
  accent: string; // teal | blue | rose | amber | slate
  price_channel: string; // retail | wholesale
  created_by: string;
  created_at: string;
  item_count: number;
};

export const CATALOG_TEMPLATES: { code: string; label: string; hint: string }[] = [
  { code: "grid", label: "ຕາຕະລາງ Card", hint: "ກ່ອງຮູບ 2-4 ຄໍລຳ ທັນສະໄໝ ເໝາະທົ່ວໄປ" },
  { code: "list", label: "ລາຍການແຖວ", hint: "ຮູບຊ້າຍ + ລາຍລະອຽດ + ລາຄາຂວາ ເໝາະສິນຄ້າມີ spec ຫຼາຍ" },
  { code: "showcase", label: "ໂຊເຄສ (ໃຫຍ່)", hint: "ຮູບໃຫຍ່ 2 ຄໍລຳ ເດັ່ນ ເໝາະສິນຄ້າ premium/ໜ້ອຍລາຍການ" },
  { code: "pricelist", label: "ລາຍການລາຄາ", hint: "ຕາຕະລາງແໜ້ນ ຮູບນ້ອຍ ເໝາະໃບລາຄາຫຼາຍລາຍການ" },
];

export const CATALOG_ACCENTS: { code: string; label: string; hex: string }[] = [
  { code: "teal", label: "ຂຽວມະກອກ", hex: "#0d9488" },
  { code: "blue", label: "ຟ້າ", hex: "#2563eb" },
  { code: "rose", label: "ບົວ", hex: "#e11d48" },
  { code: "amber", label: "ສົ້ມ", hex: "#d97706" },
  { code: "slate", label: "ເທົາເຂັ້ມ", hex: "#334155" },
];

export type CatalogItem = {
  id: number;
  item_code: string;
  name: string;
  unit: string;
  price: string;
  spec: string;
  url_image: string;
  image_base64: string;
};

export async function listCatalogs(): Promise<Catalog[]> {
  const { rows } = await pool.query<Catalog>(
    `SELECT c.id, c.title, c.subtitle, c.currency_code, c.columns, c.show_price,
            c.template, c.accent, c.price_channel, c.created_by, c.created_at::text,
            (SELECT count(*)::int FROM odg_pm_catalog_item i WHERE i.catalog_id = c.id) AS item_count
       FROM odg_pm_catalog c
      ORDER BY c.created_at DESC`,
  );
  return rows;
}

export async function getCatalog(
  id: number,
): Promise<{ catalog: Catalog; items: CatalogItem[] } | null> {
  const cRes = await pool.query<Catalog>(
    `SELECT c.id, c.title, c.subtitle, c.currency_code, c.columns, c.show_price,
            c.template, c.accent, c.price_channel, c.created_by, c.created_at::text, 0 AS item_count
       FROM odg_pm_catalog c WHERE c.id = $1`,
    [id],
  );
  const catalog = cRes.rows[0];
  if (!catalog) return null;
  // One cover image per item (base64 preferred, else filename).
  const itemsRes = await pool.query<CatalogItem>(
    `SELECT it.id, it.item_code, it.name, it.unit, it.price::text, it.spec,
            COALESCE(img.url_image,'') AS url_image,
            COALESCE(img.image_base64,'') AS image_base64
       FROM odg_pm_catalog_item it
       LEFT JOIN LATERAL (
         SELECT url_image, image_base64
           FROM product_image
          WHERE ic_code = it.item_code AND (url_image <> '' OR image_base64 <> '')
          ORDER BY (image_base64 <> '') DESC, url_image
          LIMIT 1
       ) img ON it.item_code <> ''
      WHERE it.catalog_id = $1
      ORDER BY it.sort, it.id`,
    [id],
  );
  return { catalog, items: itemsRes.rows };
}
