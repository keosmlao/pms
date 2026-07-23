import Link from "next/link";
import { getDeadStock, getStockHealth } from "@/lib/analytics";
import { getUserGroupCount } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";

function fmt(v: string | number) {
  const n = Number(v);
  return Number.isNaN(n) ? String(v) : n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
function fmtDate(v: string | null) {
  if (!v) return "-";
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : v;
}

export default async function StockHealthPage() {
  const user = await getCurrentUser();
  const isOwner = user ? (await getUserGroupCount(user.employeeCode)) > 0 : false;
  const mineOf = isOwner && user ? user.employeeCode : "";

  const [h, dead] = await Promise.all([getStockHealth(mineOf), getDeadStock(mineOf, 100)]);
  const buckets = [
    { label: "0–30 ວັນ", value: h.b0_30, tone: "bg-emerald-500" },
    { label: "31–90", value: h.b31_90, tone: "bg-teal-500" },
    { label: "91–180", value: h.b91_180, tone: "bg-amber-500" },
    { label: "181–360", value: h.b181_360, tone: "bg-orange-500" },
    { label: "> 360", value: h.b360p, tone: "bg-red-500" },
  ];
  const maxB = Math.max(1, ...buckets.map((b) => b.value));

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 text-[11px] text-slate-400"><span>ໜ້າຫຼັກ</span><span>/</span><span className="text-slate-600">ສຸຂະພາບ Stock</span></div>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">ສຸຂະພາບ Stock</h1>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">ອາຍຸ stock ແລະ ສິນຄ້າຄ້າງດົນ {isOwner ? "· ສະເພາະກຸ່ມທ່ານ" : ""}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><p className="text-xs text-slate-500">ລາຍການທີ່ມີ stock</p><p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{fmt(h.in_stock_items)}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><p className="text-xs text-slate-500">ມູນຄ່າ stock</p><p className="mt-2 text-2xl font-bold text-teal-600 dark:text-teal-400">{fmt(h.stock_value)}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><p className="text-xs text-slate-500">ຄ້າງດົນ (ບໍ່ຂາຍ 90 ວັນ)</p><p className="mt-2 text-2xl font-bold text-red-600 dark:text-red-400">{fmt(h.dead_items)}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><p className="text-xs text-slate-500">ມູນຄ່າຈົມ</p><p className="mt-2 text-2xl font-bold text-red-600 dark:text-red-400">{fmt(h.dead_value)}</p></div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">ການແຈກຢາຍອາຍຸ stock</h2>
        <div className="mt-4 space-y-2">
          {buckets.map((b) => (
            <div key={b.label} className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-xs text-slate-500">{b.label}</span>
              <div className="h-5 flex-1 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
                <div className={`h-full ${b.tone}`} style={{ width: `${(b.value / maxB) * 100}%` }} />
              </div>
              <span className="w-16 shrink-0 text-right text-xs font-semibold text-slate-700 dark:text-slate-200">{fmt(b.value)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800"><h2 className="text-sm font-bold text-slate-900 dark:text-white">ສິນຄ້າຄ້າງດົນ (ມູນຄ່າສູງສຸດ) · {dead.length}</h2></div>
        {dead.length === 0 ? <p className="px-5 py-10 text-center text-sm text-slate-400">ບໍ່ມີສິນຄ້າຄ້າງດົນ 🎉</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs">
              <thead><tr className="border-b border-slate-200 bg-slate-50/70 text-left text-[10px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950/40"><th className="px-4 py-2.5 font-semibold">ລະຫັດ</th><th className="px-4 py-2.5 font-semibold">ຊື່ / ຍີ່ຫໍ້</th><th className="px-4 py-2.5 text-right font-semibold">ຄົງເຫຼືອ</th><th className="px-4 py-2.5 text-right font-semibold">ມູນຄ່າ</th><th className="px-4 py-2.5 text-right font-semibold">ອາຍຸ (ວັນ)</th><th className="px-4 py-2.5 font-semibold">ຂາຍຫຼ້າສຸດ</th></tr></thead>
              <tbody>
                {dead.map((d) => (
                  <tr key={d.code} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-2 font-mono text-xs"><Link href={`/products/${encodeURIComponent(d.code)}`} className="font-semibold text-blue-700 hover:underline dark:text-blue-400">{d.code}</Link></td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-200"><span className="block max-w-sm truncate">{d.name}</span><span className="text-[10px] text-slate-400">{d.brand}</span></td>
                    <td className="px-4 py-2 text-right text-slate-700 dark:text-slate-200">{fmt(d.stockqty)}</td>
                    <td className="px-4 py-2 text-right font-semibold text-red-600 dark:text-red-400">{fmt(d.stock_value)}</td>
                    <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{fmt(d.aging_days)}</td>
                    <td className="px-4 py-2 text-xs text-slate-500">{fmtDate(d.last_sale_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
