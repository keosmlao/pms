import Link from "next/link";
import { redirect } from "next/navigation";
import { listMonthlyPlans } from "@/lib/monthly-plan";
import { getIsAdmin } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";
import CreateMonthlyForm from "./CreateMonthlyForm";

export default async function MonthlyListPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const isAdmin = await getIsAdmin(user.employeeCode);

  const plans = await listMonthlyPlans();

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <span>ໜ້າຫຼັກ</span><span>/</span>
        <Link href="/purchase-plan" className="hover:text-teal-600">ແຜນການສັ່ງຊື້</Link><span>/</span>
        <span className="text-slate-600">ແຜນຂາຍລາຍເດືອນ</span>
      </div>
      <div className="mt-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">ແຜນຂາຍລາຍເດືອນ</h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">ປ້ອນແຜນຂາຍ 12 ເດືອນ ຕໍ່ສິນຄ້າ · ທຽບຍອດຂາຍປີກ່ອນ ແລະ ຍອດສະສົມປີນີ້ (ດຶງຈາກ ERP)</p>
      </div>

      {isAdmin && (
        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">ສ້າງແຜນໃໝ່</h2>
          <CreateMonthlyForm />
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
                <th className="px-4 py-2.5 font-semibold">ປີ</th>
                <th className="px-4 py-2.5 text-right font-semibold">ສິນຄ້າ</th>
                <th className="px-4 py-2.5 font-semibold">ຜູ້ສ້າງ</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-2.5"><Link href={`/purchase-plan/monthly/${p.id}`} className="font-semibold text-blue-700 hover:underline dark:text-blue-400">{p.title}</Link></td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{p.plan_year}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-300">{p.item_count}</td>
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
