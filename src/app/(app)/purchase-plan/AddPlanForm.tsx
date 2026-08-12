"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import AsyncSelect from "@/components/ClientAsyncSelect";
import { addPlanItem, type PlanState } from "./actions";

const initial: PlanState = { error: null, success: null };
type Opt = { value: string; label: string };

const cls = {
  control: ({ isFocused }: { isFocused: boolean }) =>
    ["min-h-9 rounded-lg border bg-white px-1 text-sm dark:bg-slate-950", isFocused ? "border-teal-400" : "border-slate-200 dark:border-slate-700"].join(" "),
  valueContainer: () => "px-2 py-0.5",
  placeholder: () => "text-slate-400",
  input: () => "text-slate-900 dark:text-white",
  singleValue: () => "text-slate-900 dark:text-white",
  menu: () => "mt-1 overflow-hidden rounded-lg glass shadow-lg dark:border-slate-700 dark:bg-slate-900",
  menuList: () => "max-h-60 py-1",
  option: ({ isFocused }: { isFocused: boolean }) => ["cursor-pointer px-3 py-2 text-sm", isFocused ? "bg-slate-100 dark:bg-slate-800" : "text-slate-700 dark:text-slate-300"].join(" "),
};

function Btn() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="rounded-lg bg-teal-600 px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-teal-500 disabled:opacity-60">{pending ? "..." : "ເພີ່ມເຂົ້າແຜນ"}</button>;
}

export default function AddPlanForm() {
  const [state, action] = useActionState(addPlanItem, initial);

  const loadProducts = async (input: string): Promise<Opt[]> => {
    if (!input.trim()) return [];
    const res = await fetch(`/api/inventory-search?q=${encodeURIComponent(input)}&spare=0`);
    if (!res.ok) return [];
    const rows: { code: string; name: string }[] = await res.json();
    return rows.map((r) => ({ value: r.code, label: `${r.code} · ${r.name}` }));
  };
  const loadSuppliers = async (input: string): Promise<Opt[]> => {
    if (!input.trim()) return [];
    const res = await fetch(`/api/supplier-search?q=${encodeURIComponent(input)}`);
    if (!res.ok) return [];
    const rows: { code: string; name: string }[] = await res.json();
    return rows.map((r) => ({ value: r.code, label: `${r.name} · ${r.code}` }));
  };

  return (
    <form action={action} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_0.7fr_1.5fr_1fr_auto]">
      <AsyncSelect<Opt> name="item_code" instanceId="plan-item" loadOptions={loadProducts} placeholder="ຄົ້ນຫາສິນຄ້າ" noOptionsMessage={({ inputValue }) => (inputValue ? "ບໍ່ພົບ" : "ພິມເພື່ອຄົ້ນຫາ")} menuPortalTarget={typeof document !== "undefined" ? document.body : undefined} unstyled classNames={cls} styles={{ menuPortal: (b) => ({ ...b, zIndex: 50 }) }} />
      <input type="number" name="plan_qty" min={0} step="1" placeholder="ຈຳນວນ" className="min-h-9 rounded-lg glass px-3 text-sm text-slate-900 outline-none focus:border-teal-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
      <AsyncSelect<Opt> name="supplier_code" instanceId="plan-supplier" loadOptions={loadSuppliers} isClearable placeholder="ຜູ້ສະໜອງ (ບໍ່ບັງຄັບ)" noOptionsMessage={({ inputValue }) => (inputValue ? "ບໍ່ພົບ" : "ພິມເພື່ອຄົ້ນຫາ")} menuPortalTarget={typeof document !== "undefined" ? document.body : undefined} unstyled classNames={cls} styles={{ menuPortal: (b) => ({ ...b, zIndex: 50 }) }} />
      <input type="date" name="target_date" className="min-h-9 rounded-lg glass px-2 text-sm text-slate-900 outline-none focus:border-teal-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
      <Btn />
      {state.error && <p className="text-xs text-red-600 dark:text-red-400 sm:col-span-2 lg:col-span-5">{state.error}</p>}
      {state.success && <p className="text-xs text-emerald-700 dark:text-emerald-400 sm:col-span-2 lg:col-span-5">{state.success}</p>}
    </form>
  );
}
