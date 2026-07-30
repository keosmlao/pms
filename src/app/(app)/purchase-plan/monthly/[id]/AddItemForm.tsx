"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import AsyncSelect from "@/components/ClientAsyncSelect";
import { addMonthlyItem, type MonthlyState } from "../actions";

const initial: MonthlyState = { error: null, success: null };
type Opt = { value: string; label: string };

const cls = {
  control: ({ isFocused }: { isFocused: boolean }) =>
    ["min-h-9 rounded-lg border bg-white px-1 text-sm dark:bg-slate-950", isFocused ? "border-teal-400" : "border-slate-200 dark:border-slate-700"].join(" "),
  valueContainer: () => "px-2 py-0.5",
  placeholder: () => "text-slate-400",
  input: () => "text-slate-900 dark:text-white",
  singleValue: () => "text-slate-900 dark:text-white",
  menu: () => "mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900",
  menuList: () => "max-h-60 py-1",
  option: ({ isFocused }: { isFocused: boolean }) => ["cursor-pointer px-3 py-2 text-sm", isFocused ? "bg-slate-100 dark:bg-slate-800" : "text-slate-700 dark:text-slate-300"].join(" "),
};

function Btn() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="rounded-lg bg-teal-600 px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-teal-500 disabled:opacity-60">{pending ? "..." : "ເພີ່ມສິນຄ້າ"}</button>;
}

export default function AddItemForm({ planId }: { planId: number }) {
  const [state, action] = useActionState(addMonthlyItem, initial);
  const loadProducts = async (input: string): Promise<Opt[]> => {
    if (!input.trim()) return [];
    const res = await fetch(`/api/inventory-search?q=${encodeURIComponent(input)}&spare=0`);
    if (!res.ok) return [];
    const rows: { code: string; name: string }[] = await res.json();
    return rows.map((r) => ({ value: r.code, label: `${r.code} · ${r.name}` }));
  };
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-[3fr_auto]">
      <input type="hidden" name="plan_id" value={planId} />
      <AsyncSelect<Opt> name="item_code" instanceId={`mo-item-${planId}`} loadOptions={loadProducts} placeholder="ຄົ້ນຫາສິນຄ້າ" noOptionsMessage={({ inputValue }) => (inputValue ? "ບໍ່ພົບ" : "ພິມເພື່ອຄົ້ນຫາ")} menuPortalTarget={typeof document !== "undefined" ? document.body : undefined} unstyled classNames={cls} styles={{ menuPortal: (b) => ({ ...b, zIndex: 50 }) }} />
      <Btn />
      {state.error && <p className="text-xs text-red-600 dark:text-red-400 sm:col-span-2">{state.error}</p>}
      {state.success && <p className="text-xs text-emerald-700 dark:text-emerald-400 sm:col-span-2">{state.success}</p>}
    </form>
  );
}
