import Link from "next/link";
import { getAboveMaxStock, getBelowMinStock, getReorderSuggestions, getSupplierSpend } from "@/lib/analytics";
import { getIsAdmin, getUserGroupCount } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";
import AddToPlanButton from "./AddToPlanButton";

function fmt(v: string | number | null) {
  if (v == null) return "-";
  const n = Number(v);
  return Number.isNaN(n) ? String(v) : n.toLocaleString("en-US", { maximumFractionDigits: 1 });
}
function fmtDate(v: string | null) {
  if (!v) return "-";
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : v;
}

const COVER_OPTIONS = [1, 1.5, 2, 3];

export default async function ProcurementPage({
  searchParams,
}: {
  searchParams: Promise<{ cover?: string }>;
}) {
  const user = await getCurrentUser();
  const isOwner = user ? (await getUserGroupCount(user.employeeCode)) > 0 : false;
  const isAdmin = user ? await getIsAdmin(user.employeeCode) : false;
  const mineOf = isOwner && user ? user.employeeCode : "";
  const coverRaw = Number((await searchParams).cover);
  const cover = COVER_OPTIONS.includes(coverRaw) ? coverRaw : 2;

  const [reorder, belowMin, aboveMax, suppliers] = await Promise.all([
    getReorderSuggestions(mineOf, 100),
    getBelowMinStock(mineOf, 100),
    getAboveMaxStock(mineOf, 100),
    isAdmin ? getSupplierSpend(180, 15) : Promise.resolve([]),
  ]);

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 text-[11px] text-slate-400"><span>ໜ້າຫຼັກ</span><span>/</span><span className="text-slate-600">ຈັດຊື້</span></div>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">ຈັດຊື້ / ແນະນຳສັ່ງຊື້</h1>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">ສິນຄ້າຂາຍດີແຕ່ stock ໃກ້ໝົດ {isOwner ? "· ສະເພາະກຸ່ມທ່ານ" : ""}</p>

      {belowMin.length > 0 && (
        <div className="mt-5 overflow-hidden rounded-xl border border-red-200 bg-white shadow-sm dark:border-red-900 dark:bg-slate-900">
          <div className="border-b border-red-200 bg-red-50/60 px-5 py-3 dark:border-red-900 dark:bg-red-950/30">
            <h2 className="text-sm font-bold text-red-700 dark:text-red-300">⚠ ຕໍ່າກວ່າ min stock · {belowMin.length}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-xs">
              <thead><tr className="border-b border-slate-200 bg-slate-50/70 text-left text-[10px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950/40"><th className="px-4 py-2.5 font-semibold">ລະຫັດ</th><th className="px-4 py-2.5 font-semibold">ຊື່ / ຍີ່ຫໍ້</th><th className="px-4 py-2.5 text-right font-semibold">ຄົງເຫຼືອ</th><th className="px-4 py-2.5 text-right font-semibold">Min</th><th className="px-4 py-2.5 text-right font-semibold">ຂາດ</th></tr></thead>
              <tbody>
                {belowMin.map((b) => (
                  <tr key={b.code} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                    <td className="px-4 py-2 font-mono text-xs"><Link href={`/products/${encodeURIComponent(b.code)}`} className="font-semibold text-blue-700 hover:underline dark:text-blue-400">{b.code}</Link></td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-200"><span className="block max-w-xs truncate">{b.name}</span><span className="text-[10px] text-slate-400">{b.brand}</span></td>
                    <td className="px-4 py-2 text-right text-slate-700 dark:text-slate-200">{fmt(b.balance)}</td>
                    <td className="px-4 py-2 text-right text-slate-500">{fmt(b.min_qty)}</td>
                    <td className="px-4 py-2 text-right font-bold text-red-600 dark:text-red-400">{fmt(b.shortfall)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {aboveMax.length > 0 && (
        <div className="mt-5 overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm dark:border-amber-900 dark:bg-slate-900">
          <div className="border-b border-amber-200 bg-amber-50/60 px-5 py-3 dark:border-amber-900 dark:bg-amber-950/30">
            <h2 className="text-sm font-bold text-amber-700 dark:text-amber-300">⛔ ເກີນ max stock — ຢຸດສັ່ງຊື້ · {aboveMax.length}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-xs">
              <thead><tr className="border-b border-slate-200 bg-slate-50/70 text-left text-[10px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950/40"><th className="px-4 py-2.5 font-semibold">ລະຫັດ</th><th className="px-4 py-2.5 font-semibold">ຊື່ / ຍີ່ຫໍ້</th><th className="px-4 py-2.5 text-right font-semibold">ຄົງເຫຼືອ</th><th className="px-4 py-2.5 text-right font-semibold">Max</th><th className="px-4 py-2.5 text-right font-semibold">ເກີນ</th></tr></thead>
              <tbody>
                {aboveMax.map((a) => (
                  <tr key={a.code} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                    <td className="px-4 py-2 font-mono text-xs"><Link href={`/products/${encodeURIComponent(a.code)}`} className="font-semibold text-blue-700 hover:underline dark:text-blue-400">{a.code}</Link></td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-200"><span className="block max-w-xs truncate">{a.name}</span><span className="text-[10px] text-slate-400">{a.brand}</span></td>
                    <td className="px-4 py-2 text-right text-slate-700 dark:text-slate-200">{fmt(a.balance)}</td>
                    <td className="px-4 py-2 text-right text-slate-500">{fmt(a.max_qty)}</td>
                    <td className="px-4 py-2 text-right font-bold text-amber-600 dark:text-amber-400">+{fmt(a.excess)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">ແນະນຳສັ່ງຊື້ (stock &lt; 1.5 ເດືອນ) · {reorder.length}</h2>
          {isAdmin && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span>ຈຳນວນແນະນຳ ພຽງພໍ:</span>
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-950">
                {COVER_OPTIONS.map((c) => (
                  <Link key={c} href={`/procurement?cover=${c}`} className={`rounded-md px-2 py-0.5 font-semibold ${cover === c ? "bg-teal-600 text-white" : "text-slate-600 dark:text-slate-300"}`}>{c} ດ.</Link>
                ))}
              </div>
            </div>
          )}
        </div>
        {reorder.length === 0 ? <p className="px-5 py-10 text-center text-sm text-slate-400">ບໍ່ມີສິນຄ້າໃກ້ໝົດ 👍</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-xs">
              <thead><tr className="border-b border-slate-200 bg-slate-50/70 text-left text-[10px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950/40">
                <th className="px-4 py-2.5 font-semibold">ລະຫັດ</th>
                <th className="px-4 py-2.5 font-semibold">ຊື່ / ຍີ່ຫໍ້</th>
                <th className="px-4 py-2.5 text-right font-semibold">ຄົງເຫຼືອ</th>
                <th className="px-4 py-2.5 text-right font-semibold">ຂາຍ/ເດືອນ</th>
                <th className="px-4 py-2.5 text-right font-semibold">ພຽງພໍ (ເດືອນ)</th>
                <th className="px-4 py-2.5 text-right font-semibold">ຊື້ຫຼ້າສຸດ</th>
                <th className="px-4 py-2.5 text-right font-semibold">ລາຄາຊື້</th>
                {isAdmin && <th className="px-4 py-2.5 text-right font-semibold">ແຜນ</th>}
              </tr></thead>
              <tbody>
                {reorder.map((r) => {
                  const cover = Number(r.months_cover);
                  return (
                    <tr key={r.code} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-2 font-mono text-xs"><Link href={`/products/${encodeURIComponent(r.code)}`} className="font-semibold text-blue-700 hover:underline dark:text-blue-400">{r.code}</Link></td>
                      <td className="px-4 py-2 text-slate-700 dark:text-slate-200"><span className="block max-w-xs truncate">{r.name}</span><span className="text-[10px] text-slate-400">{r.brand}</span></td>
                      <td className="px-4 py-2 text-right text-slate-700 dark:text-slate-200">{fmt(r.stockqty)}</td>
                      <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{fmt(r.avg_sale)}</td>
                      <td className="px-4 py-2 text-right"><span className={`font-bold ${cover < 0.5 ? "text-red-600 dark:text-red-400" : "text-orange-600 dark:text-orange-400"}`}>{fmt(r.months_cover)}</span></td>
                      <td className="px-4 py-2 text-right text-xs text-slate-500">{fmtDate(r.last_buy_date)}</td>
                      <td className="px-4 py-2 text-right text-slate-700 dark:text-slate-200">{fmt(r.last_buy_price)}</td>
                      {isAdmin && <td className="px-4 py-2"><AddToPlanButton code={r.code} suggested={Math.max(1, Math.ceil(Number(r.avg_sale || 0) * cover - Number(r.stockqty || 0)))} /></td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800"><h2 className="text-sm font-bold text-slate-900 dark:text-white">ຜູ້ສະໜອງ ຕາມມູນຄ່າຊື້ (180 ວັນ) · {suppliers.length}</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-xs">
              <thead><tr className="border-b border-slate-200 bg-slate-50/70 text-left text-[10px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950/40"><th className="px-4 py-2.5 font-semibold">ຜູ້ສະໜອງ</th><th className="px-4 py-2.5 text-right font-semibold">ໃບຊື້</th><th className="px-4 py-2.5 text-right font-semibold">ມູນຄ່າຊື້</th></tr></thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.code} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-200">{s.supplier} <span className="font-mono text-[10px] text-slate-400">{s.code}</span></td>
                    <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{s.docs}</td>
                    <td className="px-4 py-2 text-right font-semibold text-teal-600 dark:text-teal-400">{fmt(s.spend)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
