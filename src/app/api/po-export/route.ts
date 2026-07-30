import { type NextRequest } from "next/server";
import { listPurchaseOrders, getEmployeeDepartment } from "@/lib/purchase-order";
import { getIsAdmin } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";

function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const WF: Record<string, string> = { draft: "ຮ່າງ", pending: "ລໍຖ້າອະນຸມັດ", approved: "ອະນຸມັດ", rejected: "ຖືກປະຕິເສດ" };
const RCPT: Record<string, string> = { awaiting: "ລໍຮັບ", partial: "ຮັບບາງສ່ວນ", full: "ຮັບຄົບ" };

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const sp = request.nextUrl.searchParams;
  const q = sp.get("q") ?? "";
  const status = (sp.get("status") as "all" | "pending" | "approved") ?? "all";
  const view = sp.get("view") ?? "all";
  const deptParam = sp.get("dept") ?? "";

  const [isAdmin, myDept] = await Promise.all([getIsAdmin(user.employeeCode), getEmployeeDepartment(user.employeeCode)]);
  const mine = view === "mine" ? user.employeeCode : undefined;
  const deptFilter = isAdmin ? deptParam || (view === "mydept" ? myDept : undefined) : myDept || undefined;

  const rows = await listPurchaseOrders({ q, status, mine, dept: deptFilter || undefined, limit: 300 });
  const header = ["ເລກ PO", "ຮູບແບບ", "ວັນທີ", "ຜູ້ສະໜອງ", "ລະຫັດຜູ້ສະໜອງ", "ພະແນກ", "ຜູ້ສ້າງ", "ລາຍການ", "ມູນຄ່າ", "ສະກຸນ", "ສະຖານະ"];
  const lines = [header.join(",")];
  for (const r of rows) {
    const st = r.wf_status === "approved" ? RCPT[r.receipt ?? "awaiting"] ?? "ອະນຸມັດ" : WF[r.wf_status] ?? r.wf_status;
    lines.push([
      csvCell(r.doc_no), csvCell(r.format), csvCell(r.doc_date), csvCell(r.supplier_name), csvCell(r.supplier_code),
      csvCell(r.department_name), csvCell(r.creator_name), csvCell(r.lines), csvCell(r.total_amount), csvCell(r.currency_code), csvCell(st),
    ].join(","));
  }
  const csv = "﻿" + lines.join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="purchase-orders-${rows.length}.csv"`,
    },
  });
}
