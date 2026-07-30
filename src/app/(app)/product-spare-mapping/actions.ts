"use server";

import { revalidatePath } from "next/cache";
import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export type MappingImportState = {
  error: string | null;
  added: number;
  duplicates: number;
  invalid: { row: number; product: string; spare: string; reason: string }[];
};

type InventoryKind = { code: string; is_spare: boolean };

export async function importProductSpareMappings(
  _previous: MappingImportState,
  formData: FormData,
): Promise<MappingImportState> {
  const empty = { added: 0, duplicates: 0, invalid: [] };
  const user = await getCurrentUser();
  if (!user) return { ...empty, error: "ກະລຸນາເຂົ້າລະບົບໃໝ່" };

  let input: unknown;
  try {
    input = JSON.parse(String(formData.get("mappings") ?? "[]"));
  } catch {
    return { ...empty, error: "ຮູບແບບຂໍ້ມູນບໍ່ຖືກຕ້ອງ" };
  }
  if (!Array.isArray(input) || input.length === 0) {
    return { ...empty, error: "ກະລຸນາເພີ່ມຂໍ້ມູນຢ່າງໜ້ອຍ 1 ແຖວ" };
  }

  const rawPairs = input.slice(0, 5000).map((value, index) => {
    const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
    return {
      row: index + 2,
      product: String(record.product ?? "").trim(),
      spare: String(record.spare ?? "").trim(),
    };
  });
  const pairs = [...new Map(
    rawPairs.map((pair) => [`${pair.product}\u0000${pair.spare}`, pair]),
  ).values()];

  const codes = [...new Set(pairs.flatMap((pair) => [pair.product, pair.spare]).filter(Boolean))];
  const { rows } = await pool.query<InventoryKind>(
    `SELECT code, (group_main = '14') AS is_spare
       FROM ic_inventory
      WHERE code = ANY($1::varchar[])`,
    [codes],
  );
  const inventory = new Map(rows.map((item) => [item.code, item]));
  const invalid: MappingImportState["invalid"] = [];
  const valid: typeof pairs = [];

  for (const pair of pairs) {
    const product = inventory.get(pair.product);
    const spare = inventory.get(pair.spare);
    let reason = "";
    if (!pair.product || !pair.spare) reason = "ຂໍ້ມູນບໍ່ຄົບ 2 ຄໍລຳ";
    else if (pair.product === pair.spare) reason = "ລະຫັດຊ້ຳກັນ";
    else if (!product) reason = "ບໍ່ພົບສິນຄ້າຫຼັກ";
    else if (product.is_spare) reason = "ຄໍລຳສິນຄ້າຫຼັກເປັນອາໄຫຼ່";
    else if (!spare) reason = "ບໍ່ພົບອາໄຫຼ່";
    else if (!spare.is_spare) reason = "ຄໍລຳອາໄຫຼ່ບໍ່ແມ່ນກຸ່ມອາໄຫຼ່";

    if (reason) invalid.push({ ...pair, reason });
    else valid.push(pair);
  }

  if (valid.length === 0) {
    return { ...empty, invalid, error: "ບໍ່ມີຄູ່ສິນຄ້າ–ອາໄຫຼ່ທີ່ຖືກຕ້ອງ" };
  }

  const result = await pool.query(
    `INSERT INTO odg_product_spare_mapping (product_code, spare_code, created_by)
     SELECT pair.product_code, pair.spare_code, $3
       FROM unnest($1::varchar[], $2::varchar[]) AS pair(product_code, spare_code)
     ON CONFLICT (product_code, spare_code) DO NOTHING
     RETURNING id`,
    [valid.map((pair) => pair.product), valid.map((pair) => pair.spare), user.employeeCode],
  );
  const added = result.rowCount ?? 0;
  revalidatePath("/product-spare-mapping");
  revalidatePath("/products/[code]", "page");
  return { error: null, added, duplicates: valid.length - added, invalid };
}
