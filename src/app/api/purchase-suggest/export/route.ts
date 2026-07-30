import { type NextRequest } from "next/server";
import { getSuggestions } from "@/lib/purchase-suggest";
import { BU_LABELS } from "@/lib/stock-policy";
import { getCurrentUser } from "@/lib/session";

function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Round numeric text to a plain integer/1-decimal for the CSV.
function num(v: string | null): string {
  if (v == null || v === "") return "";
  const n = Number(v);
  return Number.isNaN(n) ? String(v) : String(Math.round(n * 10) / 10);
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const sp = request.nextUrl.searchParams;
  const bu = BU_LABELS[sp.get("bu") ?? ""] ? sp.get("bu")! : "11";
  const brand = sp.get("brand") ?? "";
  const q = sp.get("q") ?? "";

  const { rows } = await getSuggestions(bu, { brand, q, limit: 5000 });
  const header = ["ຜູ້ສະໜອງ", "ລະຫັດ", "ຊື່ສິນຄ້າ", "ຍີ່ຫໍ້", "ໜ່ວຍ", "Stock", "ກຳລັງມາ", "ຂາຍ/ເດືອນ", "ຄຸ້ມ(ເດືອນ)", "DII ເປົ້າ", "ແນະນຳຊື້"];
  const lines = [header.join(",")];
  // Group by supplier so purchasing can order per vendor; items with a known
  // supplier come first (alphabetical), unknown-supplier items last.
  const sorted = [...rows].sort((a, b) => {
    const an = a.supplier_name.trim(), bn = b.supplier_name.trim();
    if (!an !== !bn) return an ? -1 : 1;
    return an.localeCompare(bn) || Number(b.recommend_buy) - Number(a.recommend_buy);
  });
  for (const r of sorted) {
    lines.push(
      [
        csvCell(r.supplier_name),
        csvCell(r.code),
        csvCell(r.name),
        csvCell(r.brand),
        csvCell(r.unit),
        num(r.stock),
        num(r.incoming),
        num(r.sale_month),
        num(r.dii_actual),
        num(r.dii_target),
        num(r.recommend_buy),
      ].join(","),
    );
  }
  const csv = "﻿" + lines.join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="buy-suggest-${bu}-${rows.length}.csv"`,
    },
  });
}
