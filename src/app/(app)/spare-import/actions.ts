"use server";

import { revalidatePath } from "next/cache";
import { pool } from "@/lib/db";
import { getIsAdmin } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";

export type ImportState = {
  error: string | null;
  summary: { spare: string; linked: number; models: number }[] | null;
  skipped: string[];
};

// Bulk-link spares to products by pasting rows like:
//   140101-2467  AS-09CR4RYRCB00C AS-12CR4RGCB01 ...
// The leading item code (\d{6}-\d{4}) is the spare; AS-xxx tokens are the
// compatible product models. Products matching a model (name/eng/model),
// excluding [SET] and MOCKUP, get linked. Spare must be group_main 14.
export async function importSpareMappings(
  _previous: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const user = await getCurrentUser();
  if (!user || !(await getIsAdmin(user.employeeCode))) {
    return { error: "ບໍ່ມີສິດ (ສະເພາະ admin)", summary: null, skipped: [] };
  }

  const text = String(formData.get("data") ?? "");
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { error: "ກະລຸນາວາງຂໍ້ມູນ", summary: null, skipped: [] };

  const summary: ImportState["summary"] = [];
  const skipped: string[] = [];

  for (const line of lines) {
    const spareCode = line.match(/\d{6}-\d{4}/)?.[0];
    const models = [...line.matchAll(/AS-[A-Za-z0-9]+/g)].map((m) => m[0].toUpperCase());
    if (!spareCode || models.length === 0) {
      skipped.push(line.slice(0, 60));
      continue;
    }

    const spare = await pool.query<{ is_spare: boolean }>(
      `SELECT (group_main = '14') AS is_spare FROM ic_inventory WHERE code = $1`,
      [spareCode],
    );
    if (!spare.rows[0]?.is_spare) {
      skipped.push(`${spareCode} (ບໍ່ແມ່ນອາໄຫຼ່)`);
      continue;
    }

    const res = await pool.query(
      `INSERT INTO odg_product_spare_mapping (product_code, spare_code, created_by)
       SELECT DISTINCT i.code, $2, $3
         FROM ic_inventory i, unnest($1::text[]) AS m(model)
        WHERE i.group_main <> '14'
          AND i.name_1 NOT ILIKE '%MOCKUP%'
          AND i.name_1 NOT ILIKE '%[SET]%'
          AND (i.name_1 ILIKE '%' || m.model || '%'
               OR i.name_eng_1 ILIKE '%' || m.model || '%'
               OR i.item_model ILIKE '%' || m.model || '%')
       ON CONFLICT (product_code, spare_code) DO NOTHING`,
      [models, spareCode, user.employeeCode],
    );
    summary.push({ spare: spareCode, linked: res.rowCount ?? 0, models: models.length });
  }

  revalidatePath("/audit");
  return { error: null, summary, skipped };
}
