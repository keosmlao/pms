"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createWeeklyPlan, type WeeklyState } from "./actions";

const initial: WeeklyState = { error: null, success: null };

const inputCls =
  "min-h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-teal-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function Btn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-lg bg-teal-600 px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-teal-500 disabled:opacity-60">
      {pending ? "..." : "ສ້າງແຜນ"}
    </button>
  );
}

export default function CreatePlanForm() {
  const [state, action] = useActionState(createWeeklyPlan, initial);
  const now = new Date();

  return (
    <form action={action} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_0.7fr_0.7fr_0.7fr_0.7fr_auto]">
      <input name="title" placeholder="ຊື່ແຜນ ເຊັ່ນ Samsung CE Q4 2026" className={inputCls} />
      <input type="number" name="plan_year" defaultValue={now.getFullYear()} min={2020} max={2100} title="ປີ" className={inputCls} />
      <input type="number" name="start_week" defaultValue={isoWeek(now)} min={1} max={53} title="ອາທິດເລີ່ມ (WK)" className={inputCls} />
      <input type="number" name="sale_weeks" defaultValue={13} min={1} max={30} title="ຈຳນວນອາທິດແຜນຂາຍ" className={inputCls} />
      <input type="number" name="arrival_weeks" defaultValue={13} min={1} max={30} title="ຈຳນວນອາທິດແຜນເຂົ້າ" className={inputCls} />
      <Btn />
      <p className="text-[10px] text-slate-400 sm:col-span-2 lg:col-span-6">ຊື່ແຜນ · ປີ · ອາທິດເລີ່ມ (WK) · ຈຳນວນອາທິດແຜນຂາຍ · ຈຳນວນອາທິດແຜນເອີ້ນເຄື່ອງເຂົ້າ</p>
      {state.error && <p className="text-xs text-red-600 dark:text-red-400 sm:col-span-2 lg:col-span-6">{state.error}</p>}
    </form>
  );
}
