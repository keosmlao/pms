import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { countPendingApprovals, getDepartments, getEmployeeDepartment, listPurchaseOrders, PO_CURRENCIES } from "@/lib/purchase-order";
import { getIsAdmin } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";
import DeptSelect from "./DeptSelect";
import { LiveClock, ElapsedCell } from "./LiveElapsed";

export const dynamic = "force-dynamic";

const CUR = Object.fromEntries(PO_CURRENCIES.map((c) => [c.code, c.label.split(" ")[0]]));

const WF: Record<string, { label: string; cls: string }> = {
  draft: { label: "ຮ່າງ", cls: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" },
  pending: { label: "ລໍຖ້າອະນຸມັດ", cls: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" },
  approved: { label: "ອະນຸມັດແລ້ວ", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" },
  rejected: { label: "ຖືກປະຕິເສດ", cls: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400" },
};

// Approved PO by receipt progress (from odg_po_remain).
const RCPT: Record<string, { label: string; cls: string }> = {
  awaiting: { label: "ອະນຸມັດແລ້ວ", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" },
  partial: { label: "ຮັບບາງສ່ວນ", cls: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400" },
  full: { label: "ຮັບຄົບແລ້ວ", cls: "bg-green-600 text-white dark:bg-green-600 dark:text-white" },
};

// Whole-row background tint by status — distinct colours + left accent stripe.
const TINT: Record<string, string> = {
  draft: "border-l-4 border-l-slate-300 hover:bg-slate-50 dark:border-l-slate-600 dark:hover:bg-slate-800/40",
  pending: "border-l-4 border-l-amber-400 bg-amber-100/70 hover:bg-amber-100 dark:border-l-amber-500 dark:bg-amber-500/15 dark:hover:bg-amber-500/25",
  rejected: "border-l-4 border-l-red-400 bg-red-100/70 hover:bg-red-100 dark:border-l-red-500 dark:bg-red-500/15 dark:hover:bg-red-500/25",
  awaiting: "border-l-4 border-l-emerald-400 bg-emerald-100/60 hover:bg-emerald-100 dark:border-l-emerald-500 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25",
  partial: "border-l-4 border-l-sky-400 bg-sky-100/70 hover:bg-sky-100 dark:border-l-sky-500 dark:bg-sky-500/15 dark:hover:bg-sky-500/25",
  full: "border-l-4 border-l-green-500 bg-green-200/70 hover:bg-green-200 dark:border-l-green-500 dark:bg-green-500/25 dark:hover:bg-green-500/30",
};

function fmtDate(d: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-GB");
}
function fmtMoney(n: string) {
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function PurchaseOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; view?: string; dept?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const q = sp.q ?? "";
  const status = (sp.status as "all" | "pending" | "approved") ?? "all";
  const view = sp.view ?? "all"; // all | mine | mydept
  const deptParam = sp.dept ?? "";

  const [isAdmin, myDept, departments] = await Promise.all([
    getIsAdmin(user.employeeCode),
    getEmployeeDepartment(user.employeeCode),
    getDepartments(),
  ]);
  const mine = view === "mine" ? user.employeeCode : undefined;
  // Non-admin staff are locked to their own department; admins can browse/filter all.
  const deptFilter = isAdmin
    ? deptParam || (view === "mydept" ? myDept : undefined)
    : myDept || undefined;

  const rows = await listPurchaseOrders({ q, status, mine, dept: deptFilter || undefined, limit: 150 });
  const pendingCount = isAdmin ? await countPendingApprovals() : 0;

  const viewTabs = isAdmin
    ? [
        { key: "all", label: "ທັງໝົດ" },
        { key: "mine", label: "ຂອງຂ້ອຍ" },
        { key: "mydept", label: "ພະແນກຂ້ອຍ" },
      ]
    : [
        { key: "all", label: "ພະແນກຂ້ອຍ" },
        { key: "mine", label: "ຂອງຂ້ອຍ" },
      ];
  const mkView = (v: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (status !== "all") p.set("status", status);
    if (v !== "all") p.set("view", v);
    return `/purchase-order${p.toString() ? `?${p}` : ""}`;
  };

  // Group by department (rows already sorted by date desc within each group).
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = r.department_name || "— ບໍ່ລະບຸພະແນກ —";
    const arr = groups.get(key);
    if (arr) arr.push(r);
    else groups.set(key, [r]);
  }
  const grouped = [...groups.entries()];
  const colCount = isAdmin ? 9 : 8;

  const tabs = [
    { key: "all", label: "ທັງໝົດ" },
    { key: "pending", label: "ລໍຖ້າອະນຸມັດ" },
    { key: "approved", label: "ອະນຸມັດແລ້ວ" },
  ];

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span>ໜ້າຫຼັກ</span>
            <span>/</span>
            <span>ຈັດຊື້</span>
            <span>/</span>
            <span className="text-slate-600">ໃບສັ່ງຊື້</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            ໃບສັ່ງຊື້ສິນຄ້າ (PO)
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {isAdmin ? "ດຶງຈາກ SML · ic_trans (POH/POT)." : "ສະເພາະພະແນກຂອງທ່ານ ·"} {rows.length} ໃບ
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex overflow-hidden rounded-lg border border-slate-200 text-xs font-medium dark:border-slate-800">
            <span className="bg-teal-600 px-3.5 py-2 text-white">ໃບສັ່ງຊື້</span>
            <Link href="/purchase-order/pending-receipt" className="bg-white px-3.5 py-2 text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400">ຄ້າງຮັບເຂົ້າ</Link>
            {isAdmin && (
              <Link href="/purchase-order/approvals" className="flex items-center gap-1.5 bg-white px-3.5 py-2 text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400">
                ອະນຸມັດ
                {pendingCount > 0 && <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">{pendingCount}</span>}
              </Link>
            )}
          </div>
          <Link
            href="/purchase-order/new"
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-500"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            ສ້າງ PO
          </Link>
        </div>
      </div>

      {/* filters */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
          {tabs.map((t) => {
            const active = status === t.key;
            const params = new URLSearchParams();
            if (q) params.set("q", q);
            if (t.key !== "all") params.set("status", t.key);
            if (view !== "all") params.set("view", view);
            if (deptParam) params.set("dept", deptParam);
            return (
              <Link
                key={t.key}
                href={`/purchase-order${params.toString() ? `?${params}` : ""}`}
                className={`px-3.5 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-teal-600 text-white"
                    : "bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
        <form className="flex-1 sm:max-w-xs" action="/purchase-order">
          {status !== "all" && <input type="hidden" name="status" value={status} />}
          {view !== "all" && <input type="hidden" name="view" value={view} />}
          {deptParam && <input type="hidden" name="dept" value={deptParam} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="ຄົ້ນຫາ ເລກ PO / ຜູ້ສະໜອງ..."
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-teal-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </form>
      </div>

      {/* who / department filter */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
          {viewTabs.map((t) => {
            const active = !deptParam && view === t.key;
            return (
              <Link
                key={t.key}
                href={mkView(t.key)}
                className={`px-3.5 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-teal-600 text-white"
                    : "bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
        {isAdmin && <DeptSelect departments={departments} value={deptParam} q={q} status={status} view={view} />}
        {(deptParam || view !== "all") && (
          <Link href={mkView("all")} className="text-xs text-teal-600 hover:underline">ລ້າງໂຕກອງ</Link>
        )}
      </div>

      {/* table */}
      <LiveClock>
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[780px] text-xs">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400 dark:border-slate-800">
              <th className="px-4 py-2 font-semibold">ເລກ PO</th>
              <th className="px-4 py-2 font-semibold">ວັນທີ</th>
              <th className="px-4 py-2 font-semibold">ໄລຍະເວລາ</th>
              <th className="px-4 py-2 font-semibold">ຜູ້ສະໜອງ</th>
              <th className="px-4 py-2 font-semibold">ຜູ້ສ້າງ</th>
              <th className="px-4 py-2 text-center font-semibold">ລາຍການ</th>
              <th className="px-4 py-2 text-right font-semibold">ມູນຄ່າ</th>
              <th className="px-4 py-2 text-center font-semibold">ສະຖານະ</th>
              {isAdmin && <th className="px-4 py-2 text-right font-semibold">ຈັດການ</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-4 py-14 text-center text-sm text-slate-400">
                  ຍັງບໍ່ມີ PO — ກົດ “ສ້າງ PO” ເພື່ອເລີ່ມ
                </td>
              </tr>
            )}
            {grouped.map(([deptName, deptRows]) => (
              <Fragment key={deptName}>
                <tr className="border-y border-slate-200 bg-slate-100/80 dark:border-slate-700 dark:bg-slate-800/60">
                  <td colSpan={colCount} className="px-4 py-2.5">
                    <span className="text-base font-bold text-slate-800 dark:text-slate-100">▸ ພະແນກ: {deptName}</span>
                    <span className="ml-2 text-xs font-medium text-slate-500">{deptRows.length} ໃບ</span>
                  </td>
                </tr>
                {deptRows.map((r) => {
                  const statusKey = r.wf_status === "approved" ? (r.receipt ?? "awaiting") : r.wf_status;
                  const badge = (r.wf_status === "approved" ? RCPT[r.receipt ?? "awaiting"] : WF[r.wf_status]) ?? WF.draft;
                  // Live cycle time (created → fully received). Freezes when full; hidden for rejected.
                  const startMs = r.created_at ? new Date(r.created_at).getTime() : null;
                  const endMs =
                    statusKey === "full"
                      ? (r.completed_at ? new Date(r.completed_at).getTime() : startMs)
                      : null;
                  const elapsedStart = r.wf_status === "rejected" ? null : startMs;
                  return (
                  <tr
                    key={r.doc_no}
                    className={`border-b border-slate-50 transition last:border-0 dark:border-slate-800/60 ${TINT[statusKey] ?? TINT.draft}`}
                  >
                    <td className="px-4 py-2">
                      <Link href={`/purchase-order/${encodeURIComponent(r.doc_no)}`} className="font-mono font-semibold text-blue-700 hover:underline dark:text-blue-400">{r.doc_no}</Link>
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        {r.format}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{fmtDate(r.doc_date)}</td>
                    <td className="px-4 py-2"><ElapsedCell startMs={elapsedStart} endMs={endMs} /></td>
                    <td className="px-4 py-2">
                      <span className="text-slate-800 dark:text-slate-200">{r.supplier_name || "-"}</span>
                      <span className="ml-1 font-mono text-[11px] text-slate-400">{r.supplier_code}</span>
                    </td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{r.creator_name || "-"}</td>
                    <td className="px-4 py-2 text-center tabular-nums text-slate-500">{r.lines}</td>
                    <td className="px-4 py-2 text-right font-medium tabular-nums text-slate-900 dark:text-white">
                      {fmtMoney(r.total_amount)}
                      <span className="ml-1 text-[11px] font-normal text-slate-400">{CUR[r.currency_code] ?? ""}</span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.cls}`}>● {badge.label}</span>
                    </td>
                    {isAdmin && (
                      <td className="whitespace-nowrap px-4 py-2 text-right">
                        {r.wf_status !== "approved" ? (
                          <Link href={`/purchase-order/${encodeURIComponent(r.doc_no)}`} className="inline-block whitespace-nowrap rounded-md border border-emerald-300 px-3 py-1.5 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-500/40 dark:text-emerald-400 dark:hover:bg-emerald-500/10">ກວດ &amp; ອະນຸມັດ</Link>
                        ) : (
                          <span className="text-[11px] text-slate-300">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      </LiveClock>
    </div>
  );
}
