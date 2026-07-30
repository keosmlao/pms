import { type NextRequest } from "next/server";
import { listPayables } from "@/lib/payables";
import { getCurrentUser } from "@/lib/session";

function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const sp = request.nextUrl.searchParams;
  const q = sp.get("q") ?? "";
  const bucket = sp.get("bucket") ?? "";

  const rows = await listPayables({ q, bucket: bucket && bucket !== "all" ? bucket : undefined, limit: 10000 });
  const header = ["ລະຫັດຜູ້ສະໜອງ", "ຊື່ຜູ້ສະໜອງ", "ເລກເອກະສານ", "ປະເພດ", "ວັນທີ", "ຄົບກຳນົດ", "ຍອດ", "ຄ້າງ", "ເກີນ(ວັນ)"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([
      csvCell(r.ap_code), csvCell(r.ap_name), csvCell(r.doc_no), csvCell(r.doc_type_name),
      csvCell(r.doc_date), csvCell(r.due_date), csvCell(r.amount), csvCell(r.balance), csvCell(r.overdue_day),
    ].join(","));
  }
  const csv = "﻿" + lines.join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payables-${rows.length}.csv"`,
    },
  });
}
