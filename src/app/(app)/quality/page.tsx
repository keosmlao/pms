import Link from "next/link";
import { getGapProducts, getQualityGaps } from "@/lib/analytics";
import { getUserGroupCount } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";

function Tile({ label, value, total, tone }: { label: string; value: number; total: number; tone: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold tracking-tight ${tone}`}>{value.toLocaleString("en-US")}</p>
      <p className="mt-1 text-[10px] text-slate-400">{pct}% ຂອງ {total.toLocaleString("en-US")} ລາຍການ</p>
    </div>
  );
}

export default async function QualityPage() {
  const user = await getCurrentUser();
  const isOwner = user ? (await getUserGroupCount(user.employeeCode)) > 0 : false;
  const mineOf = isOwner && user ? user.employeeCode : "";

  const [gaps, products] = await Promise.all([
    getQualityGaps(mineOf),
    getGapProducts(mineOf, 100),
  ]);

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <span>ໜ້າຫຼັກ</span><span>/</span><span className="text-slate-600">ຄຸນນະພາບຂໍ້ມູນ</span>
      </div>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">ຄຸນນະພາບຂໍ້ມູນສິນຄ້າ</h1>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        ສິນຄ້າທີ່ຂໍ້ມູນຍັງບໍ່ຄົບ {isOwner ? "· ສະເພາະກຸ່ມທີ່ທ່ານຮັບຜິດຊອບ" : ""}
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="ຂາດຮູບພາບ" value={gaps.no_image} total={gaps.total} tone="text-red-600 dark:text-red-400" />
        <Tile label="ຂາດລາຄາຂາຍ" value={gaps.no_price} total={gaps.total} tone="text-orange-600 dark:text-orange-400" />
        <Tile label="ຂາດໝວດ" value={gaps.no_category} total={gaps.total} tone="text-amber-600 dark:text-amber-400" />
        <Tile label="ຂາດຍີ່ຫໍ້" value={gaps.no_brand} total={gaps.total} tone="text-teal-600 dark:text-teal-400" />
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            ສິນຄ້າ (ມີ stock) ທີ່ຂໍ້ມູນບໍ່ຄົບ · {products.length} ລາຍການ
          </h2>
        </div>
        {products.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">ຂໍ້ມູນຄົບຖ້ວນ 🎉</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-[10px] uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950/40">
                  <th className="px-4 py-2.5 font-semibold">ລະຫັດ</th>
                  <th className="px-4 py-2.5 font-semibold">ຊື່ສິນຄ້າ</th>
                  <th className="px-4 py-2.5 font-semibold">ໝວດ / ຍີ່ຫໍ້</th>
                  <th className="px-4 py-2.5 font-semibold">ຂາດ</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.code} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-2 font-mono text-xs">
                      <Link href={`/products/${encodeURIComponent(p.code)}`} className="font-semibold text-blue-700 hover:underline dark:text-blue-400">{p.code}</Link>
                    </td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-200"><span className="block max-w-md truncate">{p.name_1 || "-"}</span></td>
                    <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">{p.category_name || "-"} · {p.brand || "-"}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {p.missing.map((m) => (
                          <span key={m} className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950 dark:text-red-300">{m}</span>
                        ))}
                      </div>
                    </td>
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
