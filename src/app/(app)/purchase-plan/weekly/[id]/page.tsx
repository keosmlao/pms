import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getWeeklyPlan } from "@/lib/purchase-plan-weekly";
import { getIsAdmin } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";
import AddItemForm from "./AddItemForm";
import PlanGrid, { type GridItem } from "./PlanGrid";

export default async function WeeklyPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Everyone can view; only admins can add items or edit cells.
  const isAdmin = await getIsAdmin(user.employeeCode);

  const id = Number((await params).id);
  if (!id) notFound();
  const data = await getWeeklyPlan(id);
  if (!data) notFound();
  const { plan, items } = data;

  const saleWeeks = Array.from({ length: plan.sale_weeks }, (_, i) => plan.start_week + i);
  const arrivalWeeks = Array.from({ length: plan.arrival_weeks }, (_, i) => plan.start_week + i);

  // Current week in the plan's absolute numbering (for the column highlight).
  const now = new Date();
  const t = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const isoYear = t.getUTCFullYear();
  const isoWeek = Math.ceil(((t.getTime() - Date.UTC(isoYear, 0, 1)) / 86400000 + 1) / 7);
  const currentWeek = isoWeek + (isoYear > plan.plan_year ? 52 : isoYear < plan.plan_year ? -52 : 0);

  const gridItems: GridItem[] = items.map((it) => ({
    id: it.id,
    item_code: it.item_code,
    model: it.model,
    grp: it.grp,
    name: it.name,
    stock: Number(it.stock_qty) || 0,
    liveStock: it.live_stock == null ? null : Number(it.live_stock),
    avgWeekSale: Number(it.avg_week_sale) || 0,
    policyMonths: it.policy_months == null ? null : Number(it.policy_months),
    cells: it.cells,
    actual: it.actual,
  }));

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <span>ໜ້າຫຼັກ</span><span>/</span>
        <Link href="/purchase-plan" className="hover:text-teal-600">ແຜນການສັ່ງຊື້</Link><span>/</span>
        <Link href="/purchase-plan/weekly" className="hover:text-teal-600">ແຜນລາຍອາທິດ</Link><span>/</span>
        <span className="text-slate-600">{plan.title}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{plan.title}</h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            ປີ {plan.plan_year} · ແຜນຂາຍ WK{plan.start_week}–WK{plan.start_week + plan.sale_weeks - 1} ({plan.sale_weeks} ອາທິດ)
            · ເອີ້ນເຄື່ອງເຂົ້າ WK{plan.start_week}–WK{plan.start_week + plan.arrival_weeks - 1} ({plan.arrival_weeks} ອາທິດ)
            · {items.length} ໂມເດວ
          </p>
        </div>
      </div>

      {isAdmin && (
        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">ເພີ່ມໂມເດວ</h2>
          <AddItemForm planId={plan.id} />
        </div>
      )}

      {gridItems.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400 dark:border-slate-700">ຍັງບໍ່ມີໂມເດວໃນແຜນ — ເພີ່ມດ້ານເທິງ</p>
      ) : (
        <PlanGrid planId={plan.id} saleWeeks={saleWeeks} arrivalWeeks={arrivalWeeks} items={gridItems} readOnly={!isAdmin} currentWeek={currentWeek} />
      )}
    </div>
  );
}
