import Link from "next/link";
import { getTopSellers } from "@/lib/analytics";
import { getUserGroupCount } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";

function fmt(v: string | number) {
  const n = Number(v);
  return Number.isNaN(n) ? String(v) : n.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  const isOwner = user ? (await getUserGroupCount(user.employeeCode)) > 0 : false;
  const mineOf = isOwner && user ? user.employeeCode : "";

  const top = await getTopSellers(mineOf, 50);

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 text-[11px] text-slate-400"><span>ໜ້າຫຼັກ</span><span>/</span><span className="text-slate-600">ວິເຄາະຂາຍ</span></div>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">ວິເຄາະການຂາຍ</h1>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">ຂາຍດີສຸດ 90 ວັນ ແລະ ເດືອນທີ່ stock ພຽງພໍ {isOwner ? "· ສະເພາະກຸ່ມທ່ານ" : ""}</p>

      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800"><h2 className="text-sm font-bold text-slate-900 dark:text-white">ຂາຍດີສຸດ (90 ວັນ) · {top.length}</h2></div>
        {top.length === 0 ? <p className="px-5 py-10 text-center text-sm text-slate-400">ຍັງບໍ່ມີຂໍ້ມູນຂາຍ</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr className="border-b border-slate-200 bg-slate-50/70 text-left text-[10px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950/40">
                <th className="px-4 py-2.5 font-semibold">#</th>
                <th className="px-4 py-2.5 font-semibold">ລະຫັດ</th>
                <th className="px-4 py-2.5 font-semibold">ຊື່ / ຍີ່ຫໍ້</th>
                <th className="px-4 py-2.5 text-right font-semibold">ຂາຍ 90 ວັນ</th>
                <th className="px-4 py-2.5 text-right font-semibold">ສະເລ່ຍ/ເດືອນ</th>
                <th className="px-4 py-2.5 text-right font-semibold">ຄົງເຫຼືອ</th>
                <th className="px-4 py-2.5 text-right font-semibold">ພຽງພໍ (ເດືອນ)</th>
              </tr></thead>
              <tbody>
                {top.map((s, i) => {
                  const cover = s.months_cover ? Number(s.months_cover) : null;
                  return (
                    <tr key={s.code} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-2 text-xs font-bold text-slate-400">{i + 1}</td>
                      <td className="px-4 py-2 font-mono text-xs"><Link href={`/products/${encodeURIComponent(s.code)}`} className="font-semibold text-blue-700 hover:underline dark:text-blue-400">{s.code}</Link></td>
                      <td className="px-4 py-2 text-slate-700 dark:text-slate-200"><span className="block max-w-sm truncate">{s.name}</span><span className="text-[10px] text-slate-400">{s.brand}</span></td>
                      <td className="px-4 py-2 text-right font-bold text-emerald-600 dark:text-emerald-400">{fmt(s.sale_90)}</td>
                      <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{fmt(s.avg_sale)}</td>
                      <td className="px-4 py-2 text-right text-slate-700 dark:text-slate-200">{fmt(s.stockqty)}</td>
                      <td className="px-4 py-2 text-right">
                        {cover == null ? <span className="text-slate-400">-</span> : (
                          <span className={`font-semibold ${cover < 1 ? "text-red-600 dark:text-red-400" : cover > 6 ? "text-orange-600 dark:text-orange-400" : "text-slate-700 dark:text-slate-200"}`}>{fmt(cover)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-slate-100 px-5 py-2 text-[11px] text-slate-400 dark:border-slate-800">
          ພຽງພໍ (ເດືອນ) = ຄົງເຫຼືອ ÷ ຂາຍສະເລ່ຍ/ເດືອນ · <span className="text-red-500">&lt;1</span> ໃກ້ໝົດ · <span className="text-orange-500">&gt;6</span> stock ຫຼາຍເກີນ
        </p>
      </div>
    </div>
  );
}
