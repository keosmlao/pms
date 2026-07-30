import Link from "next/link";
import { redirect } from "next/navigation";
import { getMarginReport, MARGIN_DIMS, type MarginDim } from "@/lib/reporting";
import { getUserGroupCount } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

function money(v: string | number) {
  const n = Number(v);
  return Number.isNaN(n) ? "-" : n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
function pct(profit: number, revenue: number) {
  if (!revenue) return "-";
  return `${((profit / revenue) * 100).toFixed(1)}%`;
}

const RANGES = [
  { key: "month", label: "ເດືອນນີ້" },
  { key: "3m", label: "3 ເດືອນ" },
  { key: "6m", label: "6 ເດືອນ" },
  { key: "ytd", label: "ປີນີ້" },
];

export default async function GpReportPage({ searchParams }: { searchParams: Promise<{ dim?: string; range?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const dim = (MARGIN_DIMS.some((d) => d.key === sp.dim) ? sp.dim : "brand") as MarginDim;
  const range = RANGES.some((r) => r.key === sp.range) ? sp.range! : "3m";

  const now = new Date();
  const cy = now.getFullYear();
  const cm = now.getMonth() + 1;
  const curYm = cy * 100 + cm;
  const ymMinus = (months: number) => {
    let y = cy, m = cm - months;
    while (m < 1) { m += 12; y--; }
    return y * 100 + m;
  };
  const fromYm = range === "month" ? curYm : range === "3m" ? ymMinus(2) : range === "6m" ? ymMinus(5) : cy * 100 + 1;
  const toYm = curYm;

  const isOwner = (await getUserGroupCount(user.employeeCode)) > 0;
  const { rows, totals } = await getMarginReport({ dim, fromYm, toYm, mineOf: isOwner ? user.employeeCode : "", limit: 100 });

  const totRevenue = Number(totals.revenue);
  const totProfit = Number(totals.profit);
  const dimLabel = MARGIN_DIMS.find((d) => d.key === dim)!.label;
  const mk = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ dim, range, ...patch });
    return `/gp-report?${p}`;
  };

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 text-[11px] text-slate-400"><span>ໜ້າຫຼັກ</span><span>/</span><span>ວິເຄາະ</span><span>/</span><span className="text-slate-600">ລາຍງານກຳໄລ</span></div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">ລາຍງານກຳໄລ (GP)</h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">ຂາຍ − ຕົ້ນທຶນ = ກຳໄລ · ຈາກ odg_pm_price_history {isOwner ? "· ສະເພາະກຸ່ມທ່ານ" : ""}</p>
        </div>
        <a href={`/api/gp-report-export?dim=${dim}&range=${range}`} className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-4 py-2 text-xs font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-50 dark:border-emerald-500/40 dark:bg-slate-900 dark:text-emerald-400 dark:hover:bg-emerald-500/10">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
          Export Excel
        </a>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="ຍອດຂາຍ" value={money(totRevenue)} tone="text-slate-900 dark:text-white" />
        <Tile label="ຕົ້ນທຶນ" value={money(totals.cost)} tone="text-slate-600 dark:text-slate-300" />
        <Tile label="ກຳໄລ" value={money(totProfit)} tone={totProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"} />
        <Tile label="GP %" value={pct(totProfit, totRevenue)} tone="text-teal-600 dark:text-teal-400" />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap overflow-hidden rounded-lg border border-slate-200 text-xs font-medium dark:border-slate-800">
          {MARGIN_DIMS.map((d) => (
            <Link key={d.key} href={mk({ dim: d.key })} className={`px-3.5 py-1.5 transition ${dim === d.key ? "bg-teal-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"}`}>{d.label}</Link>
          ))}
        </div>
        <div className="flex overflow-hidden rounded-lg border border-slate-200 text-xs font-medium dark:border-slate-800">
          {RANGES.map((r) => (
            <Link key={r.key} href={mk({ range: r.key })} className={`px-3.5 py-1.5 transition ${range === r.key ? "bg-teal-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"}`}>{r.label}</Link>
          ))}
        </div>
        <span className="text-[11px] text-slate-400">{String(fromYm).slice(0, 4)}/{String(fromYm).slice(4)} – {String(toYm).slice(0, 4)}/{String(toYm).slice(4)}</span>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800"><h2 className="text-sm font-bold text-slate-900 dark:text-white">ຈັດອັນດັບຕາມ {dimLabel} (ຕາມກຳໄລ) · {rows.length}</h2></div>
        {rows.length === 0 ? <p className="px-5 py-12 text-center text-sm text-slate-400">ບໍ່ມີຂໍ້ມູນຂາຍໃນຊ່ວງນີ້</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs">
              <thead><tr className="border-b border-slate-100 bg-slate-50/70 text-left text-[10px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950/40">
                <th className="px-4 py-2.5 font-semibold">#</th><th className="px-4 py-2.5 font-semibold">{dimLabel}</th>
                <th className="px-4 py-2.5 text-right font-semibold">ຈຳນວນ</th><th className="px-4 py-2.5 text-right font-semibold">ຍອດຂາຍ</th>
                <th className="px-4 py-2.5 text-right font-semibold">ຕົ້ນທຶນ</th><th className="px-4 py-2.5 text-right font-semibold">ກຳໄລ</th>
                <th className="px-4 py-2.5 text-right font-semibold">GP %</th>
              </tr></thead>
              <tbody>
                {rows.map((r, i) => {
                  const rev = Number(r.revenue), prof = Number(r.profit);
                  return (
                    <tr key={`${r.code}-${i}`} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-2 text-slate-400">{i + 1}</td>
                      <td className="px-4 py-2 text-slate-800 dark:text-slate-200">{dim === "item" && r.code ? <Link href={`/products/${encodeURIComponent(r.code)}`} className="text-blue-700 hover:underline dark:text-blue-400"><span className="font-mono text-[11px]">{r.code}</span> {r.name}</Link> : <span className="block max-w-md truncate">{r.name || r.code || "—"}</span>}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-500">{money(r.qty)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-700 dark:text-slate-200">{money(r.revenue)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-500">{money(r.cost)}</td>
                      <td className={`px-4 py-2 text-right tabular-nums font-bold ${prof >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{money(prof)}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold text-teal-600 dark:text-teal-400">{pct(prof, rev)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold tracking-tight ${tone}`}>{value}</p>
    </div>
  );
}
