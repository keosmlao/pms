import Link from "next/link";
import { redirect } from "next/navigation";
import { getReplenishmentPlan, groupBySupplier } from "@/lib/replenishment";
import { getUserGroupCount } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";
import { createReplenishmentPoAction } from "./actions";

export const dynamic = "force-dynamic";

function fmt(v: string | number) {
  const n = Number(v);
  return Number.isNaN(n) ? String(v) : n.toLocaleString("en-US", { maximumFractionDigits: 1 });
}
const CUR: Record<string, string> = { "01": "฿", "02": "₭", "03": "$", "04": "¥" };

export default async function ReplenishmentPage({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const isOwner = (await getUserGroupCount(user.employeeCode)) > 0;
  const mineOf = isOwner ? user.employeeCode : "";
  const plan = await getReplenishmentPlan(mineOf);
  const groups = groupBySupplier(plan);
  const totalNeed = plan.reduce((s, r) => s + Number(r.need), 0);

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 text-[11px] text-slate-400"><span>ໜ້າຫຼັກ</span><span>/</span><span>ຈັດຊື້</span><span>/</span><span className="text-slate-600">ເຕີມສິນຄ້າອັດຕະໂນມັດ</span></div>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">ເຕີມສິນຄ້າອັດຕະໂນມັດ</h1>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">ສິນຄ້າ ຄົງເຫຼືອ + ກຳລັງມາ ຕໍ່າກວ່າ min → ແນະນຳຊື້ຮອດ max, ຈັດກຸ່ມຕາມຜູ້ສະໜອງຫຼ້າສຸດ {isOwner ? "· ສະເພາະກຸ່ມທ່ານ" : ""}</p>

      {sp.err && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">{sp.err}</div>}

      {plan.length === 0 ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white px-5 py-16 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">ບໍ່ມີສິນຄ້າຕໍ່າກວ່າ min ໃນຕອນນີ້ 👍</p>
          <p className="mt-1 text-xs text-slate-400">ຕັ້ງ min/max ໃນໜ້າສິນຄ້າ ເພື່ອໃຫ້ລະບົບແນະນຳການເຕີມ.</p>
        </div>
      ) : (
        <>
          <p className="mt-4 text-xs text-slate-500">ພົບ <b className="text-slate-800 dark:text-white">{plan.length}</b> ລາຍການ · <b className="text-slate-800 dark:text-white">{groups.length}</b> ຜູ້ສະໜອງ · ລວມແນະນຳຊື້ {fmt(totalNeed)} ໜ່ວຍ</p>

          <div className="mt-4 flex flex-col gap-4">
            {groups.map((g) => {
              const groupTotal = g.items.reduce((s, it) => s + Number(it.need) * Number(it.last_price), 0);
              const lines = g.items.map((it) => ({
                item_code: it.code, item_name: it.name, unit: it.unit, qty: Number(it.need),
                price: Number(it.last_price), stand_value: Number(it.stand_value), divide_value: Number(it.divide_value),
              }));
              const noSupplier = g.supplier_code === "";
              return (
                <section key={g.supplier_code || "none"} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3 dark:border-slate-800">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 dark:text-white">{g.supplier_name}{g.supplier_code && <span className="ml-2 font-mono text-[11px] font-normal text-slate-400">{g.supplier_code}</span>}</h2>
                      <p className="mt-0.5 text-[11px] text-slate-400">{g.items.length} ລາຍການ · ປະມານ {fmt(groupTotal)} {CUR[g.currency_code] ?? ""}</p>
                    </div>
                    {noSupplier ? (
                      <span className="rounded-md bg-slate-100 px-3 py-1.5 text-[11px] font-medium text-slate-400 dark:bg-slate-800">ບໍ່ຮູ້ຜູ້ສະໜອງ — ເປີດ PO ດ້ວຍມື</span>
                    ) : (
                      <form action={createReplenishmentPoAction}>
                        <input type="hidden" name="supplier_code" value={g.supplier_code} />
                        <input type="hidden" name="currency_code" value={g.currency_code} />
                        <input type="hidden" name="lines" value={JSON.stringify(lines)} />
                        <button className="rounded-md bg-teal-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-teal-500">⇩ ສ້າງ PO ຮ່າງ</button>
                      </form>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-xs">
                      <thead><tr className="border-b border-slate-100 bg-slate-50/70 text-left text-[10px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950/40">
                        <th className="px-4 py-2 font-semibold">ລະຫັດ</th><th className="px-4 py-2 font-semibold">ຊື່ / ຍີ່ຫໍ້</th>
                        <th className="px-4 py-2 text-right font-semibold">ຄົງເຫຼືອ</th><th className="px-4 py-2 text-right font-semibold">ກຳລັງມາ</th>
                        <th className="px-4 py-2 text-right font-semibold">min</th><th className="px-4 py-2 text-right font-semibold">max</th>
                        <th className="px-4 py-2 text-right font-semibold text-teal-700 dark:text-teal-300">ແນະນຳຊື້</th><th className="px-4 py-2 text-right font-semibold">ລາຄາຊື້ລ້າສຸດ</th>
                      </tr></thead>
                      <tbody>
                        {g.items.map((it) => (
                          <tr key={it.code} className="border-b border-slate-50 last:border-0 dark:border-slate-800/60">
                            <td className="px-4 py-2 font-mono text-xs"><Link href={`/products/${encodeURIComponent(it.code)}`} className="font-semibold text-blue-700 hover:underline dark:text-blue-400">{it.code}</Link></td>
                            <td className="px-4 py-2 text-slate-700 dark:text-slate-200"><span className="block max-w-xs truncate">{it.name}</span><span className="text-[10px] text-slate-400">{it.brand}</span></td>
                            <td className="px-4 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{fmt(it.balance)}</td>
                            <td className="px-4 py-2 text-right tabular-nums text-sky-600 dark:text-sky-400">{Number(it.incoming) > 0 ? fmt(it.incoming) : "-"}</td>
                            <td className="px-4 py-2 text-right tabular-nums text-slate-500">{fmt(it.min)}</td>
                            <td className="px-4 py-2 text-right tabular-nums text-slate-500">{it.max ? fmt(it.max) : "-"}</td>
                            <td className="px-4 py-2 text-right tabular-nums font-bold text-teal-600 dark:text-teal-400">{fmt(it.need)}</td>
                            <td className="px-4 py-2 text-right tabular-nums text-slate-500">{Number(it.last_price) > 0 ? fmt(it.last_price) : "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
