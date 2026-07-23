import Link from "next/link";
import { redirect } from "next/navigation";
import { listWeeklyPlans } from "@/lib/purchase-plan-weekly";
import { getIsAdmin } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";
import CreatePlanForm from "./CreatePlanForm";

export default async function WeeklyPlanListPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Everyone can view; only admins can create/edit.
  const isAdmin = await getIsAdmin(user.employeeCode);

  const plans = await listWeeklyPlans();

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <span>ໜ້າຫຼັກ</span><span>/</span>
        <Link href="/purchase-plan" className="hover:text-teal-600">ແຜນການສັ່ງຊື້</Link><span>/</span>
        <span className="text-slate-600">ແຜນລາຍອາທິດ</span>
      </div>
      <div className="mt-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">ແຜນສັ່ງຊື້ລາຍອາທິດ</h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">ແຜນຂາຍລາຍອາທິດ → ຈຳນວນຕ້ອງສັ່ງ → ແຜນເອີ້ນເຄື່ອງເຂົ້າ</p>
      </div>

      {isAdmin && (
        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">ສ້າງແຜນໃໝ່</h2>
          <CreatePlanForm />
        </div>
      )}

      {plans.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400 dark:border-slate-700">ຍັງບໍ່ມີແຜນ</p>
      ) : (
        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[10px] uppercase text-slate-500 dark:border-slate-800">
                <th className="px-4 py-2.5 font-semibold">ຊື່ແຜນ</th>
                <th className="px-4 py-2.5 font-semibold">ໄລຍະ</th>
                <th className="px-4 py-2.5 text-right font-semibold">ລາຍການ</th>
                <th className="px-4 py-2.5 font-semibold">ສະຖານະ</th>
                <th className="px-4 py-2.5 font-semibold">ຜູ້ສ້າງ</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-2.5">
                    <Link href={`/purchase-plan/weekly/${p.id}`} className="font-semibold text-blue-700 hover:underline dark:text-blue-400">{p.title}</Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                    {p.plan_year} · WK{p.start_week}–WK{p.start_week + p.sale_weeks - 1}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-300">{p.item_count}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${p.status === "confirmed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"}`}>
                      {p.status === "confirmed" ? "ຢືນຢັນແລ້ວ" : "ຮ່າງ"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{p.created_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
