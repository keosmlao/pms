import Link from "next/link";
import { redirect } from "next/navigation";
import Pagination from "@/components/Pagination";
import { listPurchaseRequisitions, PR_STATUS, type PrStatus } from "@/lib/purchase-requisition";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "all", label: "ທັງໝົດ" },
  { key: "pending", label: "ລໍຖ້າອະນຸມັດ" },
  { key: "approved", label: "ອະນຸມັດແລ້ວ" },
  { key: "converted", label: "ສ້າງ PO ແລ້ວ" },
];

function fmtDate(d: string | null) {
  if (!d) return "-";
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : d;
}
function fmtMoney(v: string) {
  const n = Number(v);
  return Number.isNaN(n) ? "-" : n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export default async function PrListPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; view?: string; page?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const q = sp.q ?? "";
  const status = sp.status ?? "all";
  const view = sp.view ?? "all"; // all | mine
  const PAGE_SIZE = 50;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const fetched = await listPurchaseRequisitions({
    q, status, mine: view === "mine" ? user.employeeCode : undefined,
    limit: PAGE_SIZE + 1, offset: (page - 1) * PAGE_SIZE,
  });
  const hasNext = fetched.length > PAGE_SIZE;
  const rows = fetched.slice(0, PAGE_SIZE);

  const mk = (patch: Record<string, string>) => {
    const p = new URLSearchParams();
    const merged = { q, status: status === "all" ? "" : status, view: view === "all" ? "" : view, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/purchase-requisition${p.toString() ? `?${p}` : ""}`;
  };
  const pageHref = (pg: number) => mk({ page: pg > 1 ? String(pg) : "" });

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400"><span>ໜ້າຫຼັກ</span><span>/</span><span>ຈັດຊື້</span><span>/</span><span className="text-slate-600">ໃບຂໍຊື້</span></div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">ໃບຂໍຊື້ (PR)</h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">ພະແນກຮ້ອງຂໍ → ອະນຸມັດ → ສ້າງ PO</p>
        </div>
        <Link href="/purchase-requisition/new" className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-500">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          ສ້າງ PR
        </Link>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
          {TABS.map((t) => (
            <Link key={t.key} href={mk({ status: t.key === "all" ? "" : t.key, page: "" })}
              className={`px-3.5 py-1.5 text-xs font-medium transition ${status === t.key ? "bg-teal-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"}`}>{t.label}</Link>
          ))}
        </div>
        <div className="flex overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
          {[{ k: "all", l: "ທັງໝົດ" }, { k: "mine", l: "ຂອງຂ້ອຍ" }].map((t) => (
            <Link key={t.k} href={mk({ view: t.k === "all" ? "" : t.k, page: "" })}
              className={`px-3.5 py-1.5 text-xs font-medium transition ${view === t.k ? "bg-teal-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"}`}>{t.l}</Link>
          ))}
        </div>
        <form className="flex-1 sm:max-w-xs" action="/purchase-requisition">
          {status !== "all" && <input type="hidden" name="status" value={status} />}
          {view !== "all" && <input type="hidden" name="view" value={view} />}
          <input name="q" defaultValue={q} placeholder="ຄົ້ນຫາ ເລກ PR / ໝາຍເຫດ..." className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-teal-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
        </form>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[720px] text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-[10px] uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950/40">
              <th className="px-4 py-2.5 font-semibold">ເລກ PR</th>
              <th className="px-4 py-2.5 font-semibold">ວັນທີ</th>
              <th className="px-4 py-2.5 font-semibold">ພະແນກ</th>
              <th className="px-4 py-2.5 font-semibold">ຜູ້ຮ້ອງຂໍ</th>
              <th className="px-4 py-2.5 text-center font-semibold">ລາຍການ</th>
              <th className="px-4 py-2.5 text-right font-semibold">ລວມປະມານ</th>
              <th className="px-4 py-2.5 text-center font-semibold">ສະຖານະ</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">ຍັງບໍ່ມີ PR — ກົດ “ສ້າງ PR”</td></tr>}
            {rows.map((r) => {
              const st = PR_STATUS[r.status as PrStatus] ?? PR_STATUS.draft;
              return (
                <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-2"><Link href={`/purchase-requisition/${r.id}`} className="font-mono font-semibold text-blue-700 hover:underline dark:text-blue-400">{r.pr_no}</Link>{r.po_no && <span className="ml-2 text-[10px] text-sky-600">→ {r.po_no}</span>}</td>
                  <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{fmtDate(r.doc_date)}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-200">{r.department_name || "-"}</td>
                  <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{r.requester_name || "-"}</td>
                  <td className="px-4 py-2 text-center tabular-nums text-slate-500">{r.lines}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium text-slate-900 dark:text-white">{fmtMoney(r.est_total)}</td>
                  <td className="px-4 py-2 text-center"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${st.cls}`}>● {st.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination current={page} hasNext={hasNext} hrefFor={pageHref} />
    </div>
  );
}
