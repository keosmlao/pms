import Link from "next/link";
import { redirect } from "next/navigation";
import { getPlanItems, getPlanCount, type PlanItem } from "@/lib/purchase-plan";
import { getIsAdmin } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";
import AddPlanForm from "./AddPlanForm";
import PlanRowActions from "./PlanRowActions";

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

export default async function PurchasePlanPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const isAdmin = await getIsAdmin(user.employeeCode);
  if (!isAdmin) redirect("/products");

  const status = (await searchParams).status === "ordered" ? "ordered" : "planned";
  const [items, planned, ordered] = await Promise.all([
    getPlanItems(status),
    getPlanCount("planned"),
    getPlanCount("ordered"),
  ]);

  // Group by supplier, preserving supplier order from the query.
  const groups: { key: string; name: string; rows: PlanItem[] }[] = [];
  for (const it of items) {
    const key = it.supplier_code || "—";
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, name: it.supplier_name || "ຍັງບໍ່ກຳນົດຜູ້ສະໜອງ", rows: [] };
      groups.push(g);
    }
    g.rows.push(it);
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 text-[11px] text-slate-400"><span>ໜ້າຫຼັກ</span><span>/</span><span className="text-slate-600">ແຜນການສັ່ງຊື້</span></div>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">ແຜນການສັ່ງຊື້</h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">ຈັດກຸ່ມຕາມຜູ້ສະໜອງ · {items.length} ລາຍການ</p>
        </div>
        <div className="flex gap-2">
          <Link href="/purchase-plan/weekly" className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-500">📅 ແຜນລາຍອາທິດ</Link>
          <a href={`/api/purchase-plan/export?status=${status}`} className="rounded-lg glass px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-teal-300 hover:text-teal-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">⬇ ດາວໂຫຼດ CSV</a>
        </div>
      </div>

      <div className="mt-5 rounded-xl glass p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">ເພີ່ມລາຍການ</h2>
        <AddPlanForm />
      </div>

      <div className="mt-5 inline-flex rounded-lg glass p-0.5 text-xs dark:border-slate-700 dark:bg-slate-900">
        <Link href="/purchase-plan?status=planned" className={`rounded-md px-3 py-1.5 font-semibold ${status === "planned" ? "bg-teal-600 text-white" : "text-slate-600 dark:text-slate-300"}`}>ວາງແຜນ · {planned}</Link>
        <Link href="/purchase-plan?status=ordered" className={`rounded-md px-3 py-1.5 font-semibold ${status === "ordered" ? "bg-teal-600 text-white" : "text-slate-600 dark:text-slate-300"}`}>ສັ່ງແລ້ວ · {ordered}</Link>
      </div>

      {groups.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400 dark:border-slate-700">ຍັງບໍ່ມີລາຍການໃນແຜນ</p>
      ) : (
        <div className="mt-4 space-y-4">
          {groups.map((g) => {
            const totalQty = g.rows.reduce((s, r) => s + Number(r.plan_qty || 0), 0);
            return (
              <div key={g.key} className="overflow-hidden rounded-xl glass shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-5 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">{g.name} <span className="font-mono text-[10px] font-normal text-slate-400">{g.key !== "—" ? g.key : ""}</span></h2>
                  <span className="text-xs text-slate-500">{g.rows.length} ລາຍການ · ລວມ {fmt(totalQty)}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-xs">
                    <thead><tr className="border-b border-slate-200 text-left text-[10px] uppercase text-slate-500 dark:border-slate-800">
                      <th className="px-4 py-2.5 font-semibold">ລະຫັດ</th>
                      <th className="px-4 py-2.5 font-semibold">ຊື່ / ຍີ່ຫໍ້</th>
                      <th className="px-4 py-2.5 text-right font-semibold">ຄົງເຫຼືອ</th>
                      <th className="px-4 py-2.5 text-right font-semibold">ຂາຍ/ເດືອນ</th>
                      <th className="px-4 py-2.5 text-right font-semibold">ຈຳນວນສັ່ງ</th>
                      <th className="px-4 py-2.5 font-semibold">ວັນທີເປົ້າໝາຍ</th>
                      <th className="px-4 py-2.5 font-semibold">ໝາຍເຫດ</th>
                      <th className="px-4 py-2.5"></th>
                    </tr></thead>
                    <tbody>
                      {g.rows.map((r) => (
                        <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                          <td className="px-4 py-2 font-mono text-xs"><Link href={`/products/${encodeURIComponent(r.item_code)}`} className="font-semibold text-blue-700 hover:underline dark:text-blue-400">{r.item_code}</Link></td>
                          <td className="px-4 py-2 text-slate-700 dark:text-slate-200"><span className="block max-w-xs truncate">{r.name}</span><span className="text-[10px] text-slate-400">{r.brand}</span></td>
                          <td className="px-4 py-2 text-right text-slate-700 dark:text-slate-200">{fmt(r.balance)}</td>
                          <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{fmt(r.avg_sale)}</td>
                          <td className="px-4 py-2 text-right font-bold text-teal-600 dark:text-teal-400">{fmt(r.plan_qty)}</td>
                          <td className="px-4 py-2 text-xs text-slate-500">{fmtDate(r.target_date)}</td>
                          <td className="px-4 py-2 text-xs text-slate-500"><span className="block max-w-[160px] truncate">{r.note}</span></td>
                          <td className="px-4 py-2">{status === "planned" && <PlanRowActions id={r.id} />}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
