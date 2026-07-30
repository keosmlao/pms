import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getMonthlyPlan } from "@/lib/monthly-plan";
import { getIsAdmin } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";
import AddItemForm from "./AddItemForm";
import MonthlyGrid, { type GridItem } from "./MonthlyGrid";

export default async function MonthlyPlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const isAdmin = await getIsAdmin(user.employeeCode);

  const id = Number((await params).id);
  if (!id) notFound();
  const data = await getMonthlyPlan(id);
  if (!data) notFound();
  const { plan, items } = data;

  const gridItems: GridItem[] = items.map((it) => ({
    id: it.id,
    item_code: it.item_code,
    name: it.name,
    brand: it.brand,
    plan: it.plan,
    lastYear: it.lastYear,
    thisYear: it.thisYear,
  }));

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <span>ໜ້າຫຼັກ</span><span>/</span>
        <Link href="/purchase-plan" className="hover:text-teal-600">ແຜນການສັ່ງຊື້</Link><span>/</span>
        <Link href="/purchase-plan/monthly" className="hover:text-teal-600">ແຜນຂາຍລາຍເດືອນ</Link><span>/</span>
        <span className="text-slate-600">{plan.title}</span>
      </div>
      <div className="mt-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{plan.title}</h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">ປີ {plan.plan_year} · {items.length} ສິນຄ້າ · ທຽບກັບຍອດຂາຍຈິງ {plan.plan_year - 1} ແລະ ຍອດສະສົມ {plan.plan_year}</p>
      </div>

      {isAdmin && (
        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">ເພີ່ມສິນຄ້າ</h2>
          <AddItemForm planId={plan.id} />
        </div>
      )}

      {gridItems.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400 dark:border-slate-700">ຍັງບໍ່ມີສິນຄ້າ — ເພີ່ມດ້ານເທິງ</p>
      ) : (
        <MonthlyGrid planId={plan.id} planYear={plan.plan_year} items={gridItems} readOnly={!isAdmin} />
      )}
    </div>
  );
}
