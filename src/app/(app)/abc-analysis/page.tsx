import Link from "next/link";
import Pagination from "@/components/Pagination";
import { getAbcSummary, getAbcItems } from "@/lib/analytics";
import { getUserGroupCount } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";

function fmt(v: string | number | null) {
  if (v == null || v === "") return "-";
  const n = Number(v);
  return Number.isNaN(n) ? String(v) : n.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

const CLASS_META: Record<string, { color: string; ring: string; desc: string }> = {
  A: { color: "text-rose-600 dark:text-rose-400", ring: "border-rose-200 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/30", desc: "ສຳຄັນສຸດ · ຄຸມໃກ້ຊິດ ຫ້າມຂາດ" },
  B: { color: "text-amber-600 dark:text-amber-400", ring: "border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30", desc: "ປານກາງ · ຕິດຕາມປົກກະຕິ" },
  C: { color: "text-slate-500 dark:text-slate-400", ring: "border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-950/30", desc: "ນ້ອຍ · ຄຸມແບບຫຼວມ ຫຼີກລ້ຽງ stock ຫຼາຍ" },
};

export default async function AbcAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ klass?: string; page?: string }>;
}) {
  const user = await getCurrentUser();
  const isOwner = user ? (await getUserGroupCount(user.employeeCode)) > 0 : false;
  const mineOf = isOwner && user ? user.employeeCode : "";
  const sp = await searchParams;
  const klass = ["A", "B", "C"].includes(sp.klass ?? "") ? sp.klass! : "A";
  const PAGE_SIZE = 50;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const [summary, itemsFetched] = await Promise.all([
    getAbcSummary(mineOf),
    getAbcItems(mineOf, klass, PAGE_SIZE + 1, (page - 1) * PAGE_SIZE),
  ]);
  const hasNext = itemsFetched.length > PAGE_SIZE;
  const items = itemsFetched.slice(0, PAGE_SIZE);
  const pageHref = (pg: number) => {
    const p = new URLSearchParams();
    if (klass !== "A") p.set("klass", klass);
    if (pg > 1) p.set("page", String(pg));
    return `/abc-analysis${p.toString() ? `?${p}` : ""}`;
  };
  const byClass = Object.fromEntries(summary.map((s) => [s.abc, s]));

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 text-[11px] text-slate-400"><span>ໜ້າຫຼັກ</span><span>/</span><span className="text-slate-600">ວິເຄາະ ABC</span></div>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">ວິເຄາະ ABC (ຄວາມສຳຄັນສິນຄ້າ)</h1>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">ຈັດອັນດັບຕາມມູນຄ່າການຂາຍ 90 ວັນ (ຈຳນວນຂາຍ × ຕົ້ນທຶນ) {isOwner ? "· ສະເພາະກຸ່ມທ່ານ" : ""}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {["A", "B", "C"].map((k) => {
          const s = byClass[k];
          const m = CLASS_META[k];
          return (
            <div key={k} className={`rounded-xl border p-4 shadow-sm ${m.ring}`}>
              <div className="flex items-center justify-between">
                <span className={`text-2xl font-black ${m.color}`}>{k}</span>
                <span className="text-right text-xs text-slate-500"><span className={`block text-lg font-bold ${m.color}`}>{s?.value_pct ?? "0"}%</span>ຂອງມູນຄ່າ</span>
              </div>
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">{m.desc}</p>
              <div className="mt-3 flex items-center justify-between border-t border-slate-200/60 pt-2 text-xs dark:border-slate-700/60">
                <span className="text-slate-500">{fmt(s?.items ?? 0)} ລາຍການ</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{fmt(s?.value ?? 0)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs dark:border-slate-700 dark:bg-slate-900">
        {["A", "B", "C"].map((k) => (
          <Link key={k} href={`/abc-analysis?klass=${k}`} className={`rounded-md px-4 py-1.5 font-semibold ${klass === k ? "bg-teal-600 text-white" : "text-slate-600 dark:text-slate-300"}`}>Class {k} · {fmt(byClass[k]?.items ?? 0)}</Link>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">ສິນຄ້າ Class {klass} · ໜ້າ {page}</h2>
        </div>
        {items.length === 0 ? <p className="px-5 py-10 text-center text-sm text-slate-400">ບໍ່ມີຂໍ້ມູນ</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs">
              <thead><tr className="border-b border-slate-200 bg-slate-50/70 text-left text-[10px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950/40">
                <th className="px-4 py-2.5 font-semibold">#</th>
                <th className="px-4 py-2.5 font-semibold">ລະຫັດ</th>
                <th className="px-4 py-2.5 font-semibold">ຊື່ / ຍີ່ຫໍ້</th>
                <th className="px-4 py-2.5 text-right font-semibold">ຂາຍ 90ວ (ໜ່ວຍ)</th>
                <th className="px-4 py-2.5 text-right font-semibold">ມູນຄ່າຂາຍ</th>
                <th className="px-4 py-2.5 text-right font-semibold">ສະສົມ %</th>
                <th className="px-4 py-2.5 text-right font-semibold">ຄົງເຫຼືອ</th>
                <th className="px-4 py-2.5 text-right font-semibold">ພຽງພໍ (ດ.)</th>
              </tr></thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={r.code} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-2 text-xs text-slate-400">{(page - 1) * PAGE_SIZE + i + 1}</td>
                    <td className="px-4 py-2 font-mono text-xs"><Link href={`/products/${encodeURIComponent(r.code)}`} className="font-semibold text-blue-700 hover:underline dark:text-blue-400">{r.code}</Link></td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-200"><span className="block max-w-xs truncate">{r.name}</span><span className="text-[10px] text-slate-400">{r.brand}</span></td>
                    <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{fmt(r.sale_90)}</td>
                    <td className="px-4 py-2 text-right font-semibold text-teal-600 dark:text-teal-400">{fmt(r.usage_value)}</td>
                    <td className="px-4 py-2 text-right text-xs text-slate-500">{fmt(r.cum_pct)}%</td>
                    <td className="px-4 py-2 text-right text-slate-700 dark:text-slate-200">{fmt(r.stockqty)}</td>
                    <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{fmt(r.months_cover)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Pagination current={page} hasNext={hasNext} hrefFor={pageHref} />
    </div>
  );
}
