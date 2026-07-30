import { redirect } from "next/navigation";
import Link from "next/link";
import { getPivot, MARGIN_DIMS, PIVOT_MEASURES, type MarginDim, type PivotMeasure } from "@/lib/reporting";
import { getUserGroupCount } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

function money(v: number) {
  if (!v) return "-";
  return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
function ymLabel(ym: number) {
  return `${String(ym).slice(4)}/${String(ym).slice(2, 4)}`;
}

const RANGES = [
  { key: "6m", label: "6 ເດືອນ" },
  { key: "12m", label: "12 ເດືອນ" },
  { key: "ytd", label: "ປີນີ້" },
];

export default async function PivotPage({ searchParams }: { searchParams: Promise<{ dim?: string; measure?: string; range?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const dim = (MARGIN_DIMS.some((d) => d.key === sp.dim) ? sp.dim : "brand") as MarginDim;
  const measure = (PIVOT_MEASURES.some((m) => m.key === sp.measure) ? sp.measure : "revenue") as PivotMeasure;
  const range = RANGES.some((r) => r.key === sp.range) ? sp.range! : "6m";

  const now = new Date();
  const cy = now.getFullYear();
  const cm = now.getMonth() + 1;
  const curYm = cy * 100 + cm;
  const ymMinus = (months: number) => {
    let y = cy, m = cm - months;
    while (m < 1) { m += 12; y--; }
    return y * 100 + m;
  };
  const fromYm = range === "6m" ? ymMinus(5) : range === "12m" ? ymMinus(11) : cy * 100 + 1;
  const toYm = curYm;

  const isOwner = (await getUserGroupCount(user.employeeCode)) > 0;
  const pivot = await getPivot({ rowDim: dim, measure, fromYm, toYm, mineOf: isOwner ? user.employeeCode : "", limit: 40 });

  const mk = (patch: Record<string, string>) => new URLSearchParams({ dim, measure, range, ...patch }).toString();
  const dimLabel = MARGIN_DIMS.find((d) => d.key === dim)!.label;

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 text-[11px] text-slate-400"><span>ໜ້າຫຼັກ</span><span>/</span><span>ວິເຄາະ</span><span>/</span><span className="text-slate-600">Pivot</span></div>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">ຕາຕະລາງ Pivot</h1>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{dimLabel} × ເດືອນ · ຈາກ odg_pm_price_history {isOwner ? "· ສະເພາະກຸ່ມທ່ານ" : ""}</p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap overflow-hidden rounded-lg border border-slate-200 text-xs font-medium dark:border-slate-800">
          {MARGIN_DIMS.map((d) => (
            <Link key={d.key} href={`/pivot?${mk({ dim: d.key })}`} className={`px-3.5 py-1.5 transition ${dim === d.key ? "bg-teal-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"}`}>{d.label}</Link>
          ))}
        </div>
        <div className="flex overflow-hidden rounded-lg border border-slate-200 text-xs font-medium dark:border-slate-800">
          {PIVOT_MEASURES.map((m) => (
            <Link key={m.key} href={`/pivot?${mk({ measure: m.key })}`} className={`px-3.5 py-1.5 transition ${measure === m.key ? "bg-indigo-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"}`}>{m.label}</Link>
          ))}
        </div>
        <div className="flex overflow-hidden rounded-lg border border-slate-200 text-xs font-medium dark:border-slate-800">
          {RANGES.map((r) => (
            <Link key={r.key} href={`/pivot?${mk({ range: r.key })}`} className={`px-3.5 py-1.5 transition ${range === r.key ? "bg-teal-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"}`}>{r.label}</Link>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {pivot.rows.length === 0 ? <p className="px-5 py-12 text-center text-sm text-slate-400">ບໍ່ມີຂໍ້ມູນໃນຊ່ວງນີ້</p> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 dark:bg-slate-950">
                  <th className="sticky left-0 z-10 bg-slate-50 px-4 py-2.5 text-left font-semibold dark:bg-slate-950">{dimLabel}</th>
                  {pivot.months.map((ym) => (
                    <th key={ym} className="px-3 py-2.5 text-right font-semibold tabular-nums">{ymLabel(ym)}</th>
                  ))}
                  <th className="bg-slate-100 px-4 py-2.5 text-right font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">ລວມ</th>
                </tr>
              </thead>
              <tbody>
                {pivot.rows.map((r) => (
                  <tr key={r.code} className="border-b border-slate-50 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/40">
                    <td className="sticky left-0 z-10 max-w-[220px] truncate bg-white px-4 py-2 font-medium text-slate-800 group-hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200" title={r.name}>{r.name}</td>
                    {pivot.months.map((ym) => {
                      const v = r.cells[ym] ?? 0;
                      const share = r.total > 0 ? v / r.total : 0;
                      return (
                        <td key={ym} className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300" style={{ background: v > 0 ? `color-mix(in srgb, var(--heat, #14b8a6) ${Math.round(share * 45)}%, transparent)` : undefined }}>{v ? money(v) : "·"}</td>
                      );
                    })}
                    <td className="bg-slate-50 px-4 py-2 text-right font-bold tabular-nums text-slate-800 dark:bg-slate-800/40 dark:text-white">{money(r.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold dark:border-slate-700 dark:bg-slate-950">
                  <td className="sticky left-0 z-10 bg-slate-50 px-4 py-2.5 text-left text-slate-700 dark:bg-slate-950 dark:text-slate-200">ລວມທັງໝົດ</td>
                  {pivot.months.map((ym) => (
                    <td key={ym} className="px-3 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-200">{money(pivot.colTotals[ym] ?? 0)}</td>
                  ))}
                  <td className="bg-slate-100 px-4 py-2.5 text-right text-teal-700 dark:bg-slate-800 dark:text-teal-300">{money(pivot.grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
      <p className="mt-2 text-[10px] text-slate-400">ສະແດງ Top {pivot.rows.length} {dimLabel} ຕາມຄ່າລວມ · ສີເຂັ້ມ = ສັດສ່ວນສູງໃນແຖວ</p>
    </div>
  );
}
