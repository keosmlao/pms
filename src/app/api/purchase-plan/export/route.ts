import { type NextRequest } from "next/server";
import { getPlanItems } from "@/lib/purchase-plan";
import { getCurrentUser } from "@/lib/session";

function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const status = request.nextUrl.searchParams.get("status") ?? "planned";
  const rows = await getPlanItems(status);
  const header = ["ຜູ້ສະໜອງ", "ລະຫັດ", "ຊື່ສິນຄ້າ", "ຍີ່ຫໍ້", "ຄົງເຫຼືອ", "ຂາຍ/ເດືອນ", "ຈຳນວນສັ່ງ", "ວັນທີເປົ້າໝາຍ", "ໝາຍເຫດ"];
  const lines = [header.join(",")];
  for (const p of rows) {
    lines.push(
      [
        csvCell(p.supplier_name),
        csvCell(p.item_code),
        csvCell(p.name),
        csvCell(p.brand),
        csvCell(p.balance),
        csvCell(p.avg_sale),
        csvCell(p.plan_qty),
        csvCell(p.target_date),
        csvCell(p.note),
      ].join(","),
    );
  }
  const csv = "﻿" + lines.join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="purchase-plan-${rows.length}.csv"`,
    },
  });
}
