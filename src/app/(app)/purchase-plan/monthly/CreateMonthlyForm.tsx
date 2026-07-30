"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createMonthlyPlan, type MonthlyState } from "./actions";

const initial: MonthlyState = { error: null, success: null };
const inputCls =
  "min-h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-teal-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

function Btn() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="rounded-lg bg-teal-600 px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-teal-500 disabled:opacity-60">{pending ? "..." : "ສ້າງແຜນ"}</button>;
}

export default function CreateMonthlyForm() {
  const [state, action] = useActionState(createMonthlyPlan, initial);
  const year = new Date().getFullYear();
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-[2fr_0.7fr_auto]">
      <input name="title" placeholder="ຊື່ແຜນ ເຊັ່ນ ແຜນຂາຍ Samsung 2026" className={inputCls} />
      <input type="number" name="plan_year" defaultValue={year} min={2020} max={2100} className={inputCls} />
      <Btn />
      {state.error && <p className="text-xs text-red-600 dark:text-red-400 sm:col-span-3">{state.error}</p>}
    </form>
  );
}
