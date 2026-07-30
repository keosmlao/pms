import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import Pagination from "@/components/Pagination";
import { getPayableSummary, listPayables } from "@/lib/payables";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

function money(v: string | number) {
  const n = Number(v);
  return Number.isNaN(n) ? "-" : n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
function fmtDate(v: string | null) {
  if (!v) return "-";
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : v;
}

const BUCKETS = [
  { key: "all", label: "ທັງໝົດ", tone: "" },
  { key: "notdue", label: "ຍັງບໍ່ຮອດກຳນົດ", tone: "text-slate-500" },
  { key: "b1_30", label: "ເກີນ 1–30", tone: "text-amber-600" },
  { key: "b31_60", label: "31–60", tone: "text-orange-600" },
  { key: "b61_90", label: "61–90", tone: "text-red-500" },
  { key: "b90p", label: "90+", tone: "text-red-700" },
];

export default async function PayablesPage({ searchParams }: { searchParams: Promise<{ q?: string; bucket?: string; group_by?: string; page?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const q = sp.q ?? "";
  const bucket = BUCKETS.some((b) => b.key === sp.bucket) ? sp.bucket! : "all";
  const groupBy = sp.group_by === "supplier" ? "supplier" : "";
  const PAGE_SIZE = 50;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const [summary, fetched] = await Promise.all([
    getPayableSummary(),
    listPayables({ q, bucket: bucket === "all" ? undefined : bucket, groupBy, limit: PAGE_SIZE + 1, offset: (page - 1) * PAGE_SIZE }),
  ]);
  const hasNext = fetched.length > PAGE_SIZE;
  const rows = fetched.slice(0, PAGE_SIZE);
  const mk = (patch: Record<string, string>) => {
    const p = new URLSearchParams();
    const merged = { q, bucket: bucket === "all" ? "" : bucket, group_by: groupBy, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/payables${p.toString() ? `?${p}` : ""}`;
  };
  const pageHref = (pg: number) => mk({ page: pg > 1 ? String(pg) : "" });

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 text-[11px] text-slate-400"><span>ໜ້າຫຼັກ</span><span>/</span><span>ຈັດຊື້</span><span>/</span><span className="text-slate-600">ໜີ້ຄ້າງຈ່າຍ</span></div>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">ໜີ້ຄ້າງຈ່າຍ (AP)</h1>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">ໜີ້ຜູ້ສະໜອງ ແຍກຕາມ aging · ຈາກ odg_ap_balance</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="ຄ້າງຈ່າຍທັງໝົດ" value={money(summary.outstanding)} tone="text-slate-900 dark:text-white" note={`${summary.docs.toLocaleString("en-US")} ໃບ · ${summary.suppliers} ຜູ້ສະໜອງ`} />
        <Tile label="ຍັງບໍ່ຮອດກຳນົດ" value={money(summary.not_due)} tone="text-slate-600 dark:text-slate-300" />
        <Tile label="ເກີນກຳນົດ" value={money(summary.overdue)} tone="text-red-600 dark:text-red-400" />
        <Tile label="ເກີນ 90+ ວັນ" value={money(summary.b90p)} tone="text-red-700 dark:text-red-400" />
      </div>

      {/* aging strip */}
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        {[
          { l: "1–30 ວັນ", v: summary.b1_30, c: "border-amber-300" },
          { l: "31–60 ວັນ", v: summary.b31_60, c: "border-orange-300" },
          { l: "61–90 ວັນ", v: summary.b61_90, c: "border-red-300" },
          { l: "90+ ວັນ", v: summary.b90p, c: "border-red-500" },
        ].map((b) => (
          <div key={b.l} className={`rounded-lg border-l-4 ${b.c} border-y border-r border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900`}>
            <p className="text-[10px] text-slate-400">{b.l}</p>
            <p className="text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100">{money(b.v)}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap overflow-hidden rounded-lg border border-slate-200 text-xs font-medium dark:border-slate-800">
          {BUCKETS.map((b) => (
            <Link key={b.key} href={mk({ bucket: b.key === "all" ? "" : b.key, page: "" })}
              className={`px-3.5 py-1.5 transition ${bucket === b.key ? "bg-teal-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"}`}>{b.label}</Link>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-slate-400">ຈັດກຸ່ມ:</span>
          <div className="flex overflow-hidden rounded-lg border border-slate-200 text-xs font-medium dark:border-slate-800">
            {[{ k: "", l: "ບໍ່ຈັດ" }, { k: "supplier", l: "ຜູ້ສະໜອງ" }].map((o) => (
              <Link key={o.k} href={mk({ group_by: o.k, page: "" })} className={`px-3 py-1.5 transition ${groupBy === o.k ? "bg-teal-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"}`}>{o.l}</Link>
            ))}
          </div>
        </div>
        <form className="flex-1 sm:max-w-xs" action="/payables">
          {bucket !== "all" && <input type="hidden" name="bucket" value={bucket} />}
          <input name="q" defaultValue={q} placeholder="ຄົ້ນຫາ ຜູ້ສະໜອງ / ເອກະສານ..." className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-teal-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
        </form>
        <a href={`/api/payables-export?${new URLSearchParams({ ...(q ? { q } : {}), ...(bucket !== "all" ? { bucket } : {}) })}`} className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3.5 py-2 text-xs font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-50 dark:border-emerald-500/40 dark:bg-slate-900 dark:text-emerald-400 dark:hover:bg-emerald-500/10">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
          Excel
        </a>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[760px] text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-[10px] uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950/40">
              <th className="px-4 py-2.5 font-semibold">ຜູ້ສະໜອງ</th>
              <th className="px-4 py-2.5 font-semibold">ເອກະສານ</th>
              <th className="px-4 py-2.5 font-semibold">ຄົບກຳນົດ</th>
              <th className="px-4 py-2.5 text-right font-semibold">ຍອດ</th>
              <th className="px-4 py-2.5 text-right font-semibold">ຄ້າງ</th>
              <th className="px-4 py-2.5 text-center font-semibold">ເກີນ(ວັນ)</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">ບໍ່ມີໜີ້ຄ້າງໃນເງື່ອນໄຂນີ້</td></tr>}
            {rows.map((r, i) => {
              const showHeader = groupBy === "supplier" && (i === 0 || rows[i - 1].ap_code !== r.ap_code);
              return (
              <Fragment key={`${r.doc_no}-${i}`}>
              {showHeader && (
                <tr className="border-y border-slate-200 bg-slate-100/80 dark:border-slate-700 dark:bg-slate-800/60">
                  <td colSpan={6} className="px-4 py-2 text-[13px] font-bold text-slate-700 dark:text-slate-100">▸ {r.ap_name || r.ap_code} <span className="ml-1 font-mono text-[10px] font-normal text-slate-400">{r.ap_code}</span></td>
                </tr>
              )}
              <tr className="border-b border-slate-50 last:border-0 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/40">
                <td className="px-4 py-2"><Link href={`/vendors/${encodeURIComponent(r.ap_code)}`} className="font-medium text-blue-700 hover:underline dark:text-blue-400"><span className="block max-w-xs truncate">{r.ap_name || r.ap_code}</span></Link><span className="font-mono text-[10px] text-slate-400">{r.ap_code}</span></td>
                <td className="px-4 py-2"><span className="font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-200">{r.doc_no || "-"}</span><span className="block text-[10px] text-slate-400">{r.doc_type_name}</span></td>
                <td className="px-4 py-2 text-slate-500">{fmtDate(r.due_date)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-500">{money(r.amount)}</td>
                <td className="px-4 py-2 text-right tabular-nums font-semibold text-amber-600 dark:text-amber-400">{money(r.balance)}</td>
                <td className="px-4 py-2 text-center">{r.overdue_day > 0 ? <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${r.overdue_day > 90 ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"}`}>{r.overdue_day}</span> : <span className="text-emerald-600">✓</span>}</td>
              </tr>
              </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination current={page} hasNext={hasNext} hrefFor={pageHref} />
    </div>
  );
}

function Tile({ label, value, tone, note }: { label: string; value: string; tone: string; note?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold tracking-tight ${tone}`}>{value}</p>
      {note && <p className="mt-1 text-[10px] text-slate-400">{note}</p>}
    </div>
  );
}
