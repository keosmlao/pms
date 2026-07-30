import { type NextRequest } from "next/server";
import { getMarginReport, MARGIN_DIMS, type MarginDim } from "@/lib/reporting";
import { getUserGroupCount } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";

function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const sp = request.nextUrl.searchParams;
  const dim = (MARGIN_DIMS.some((d) => d.key === sp.get("dim")) ? sp.get("dim") : "brand") as MarginDim;
  const range = ["month", "3m", "6m", "ytd"].includes(sp.get("range") ?? "") ? sp.get("range")! : "3m";

  const now = new Date();
  const cy = now.getFullYear();
  const cm = now.getMonth() + 1;
  const curYm = cy * 100 + cm;
  const ymMinus = (m: number) => { let y = cy, mm = cm - m; while (mm < 1) { mm += 12; y--; } return y * 100 + mm; };
  const fromYm = range === "month" ? curYm : range === "3m" ? ymMinus(2) : range === "6m" ? ymMinus(5) : cy * 100 + 1;

  const isOwner = (await getUserGroupCount(user.employeeCode)) > 0;
  const { rows } = await getMarginReport({ dim, fromYm, toYm: curYm, mineOf: isOwner ? user.employeeCode : "", limit: 500 });
  const dimLabel = MARGIN_DIMS.find((d) => d.key === dim)!.label;

  const header = [dimLabel, "ຈຳນວນ", "ຍອດຂາຍ", "ຕົ້ນທຶນ", "ກຳໄລ", "GP%"];
  const lines = [header.join(",")];
  for (const r of rows) {
    const rev = Number(r.revenue), prof = Number(r.profit);
    lines.push([
      csvCell(r.name || r.code),
      csvCell(r.qty),
      csvCell(r.revenue),
      csvCell(r.cost),
      csvCell(r.profit),
      csvCell(rev ? ((prof / rev) * 100).toFixed(1) : ""),
    ].join(","));
  }
  const csv = "﻿" + lines.join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gp-${dim}-${fromYm}-${curYm}.csv"`,
    },
  });
}
