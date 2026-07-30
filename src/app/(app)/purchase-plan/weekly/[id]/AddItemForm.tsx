"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import AsyncSelect from "@/components/ClientAsyncSelect";
import { addWeeklyItem, refreshStock, type WeeklyState } from "../actions";

const initial: WeeklyState = { error: null, success: null };
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

const inputCls =
  "min-h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-teal-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

function Btn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="rounded-lg bg-teal-600 px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-teal-500 disabled:opacity-60">{pending ? "..." : label}</button>;
}

export default function AddItemForm({ planId }: { planId: number }) {
  const [state, action] = useActionState(addWeeklyItem, initial);
  const [refreshState, refreshAction] = useActionState(refreshStock, initial);

  const loadProducts = async (input: string): Promise<Opt[]> => {
    if (!input.trim()) return [];
    const res = await fetch(`/api/inventory-search?q=${encodeURIComponent(input)}&spare=0`);
    if (!res.ok) return [];
    const rows: { code: string; name: string }[] = await res.json();
    return rows.map((r) => ({ value: r.code, label: `${r.code} · ${r.name}` }));
  };

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <form action={action} className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_1.2fr_0.7fr_0.9fr_auto]">
        <input type="hidden" name="plan_id" value={planId} />
        <AsyncSelect<Opt> name="item_code" instanceId={`wk-item-${planId}`} isClearable loadOptions={loadProducts} placeholder="ຄົ້ນຫາສິນຄ້າໃນ ERP" noOptionsMessage={({ inputValue }) => (inputValue ? "ບໍ່ພົບ" : "ພິມເພື່ອຄົ້ນຫາ")} menuPortalTarget={typeof document !== "undefined" ? document.body : undefined} unstyled classNames={cls} styles={{ menuPortal: (b) => ({ ...b, zIndex: 50 }) }} />
        <input name="model" placeholder="ຊື່ໂມເດວ (ຫຼື ໂມເດວໃໝ່ທີ່ຍັງບໍ່ມີໃນ ERP)" className={inputCls} />
        <input name="grp" list={`grp-list-${planId}`} placeholder="ກຸ່ມ" className={inputCls} />
        <datalist id={`grp-list-${planId}`}>
          <option value="REF" />
          <option value="WM" />
          <option value="TV" />
          <option value="AIR" />
        </datalist>
        <select name="plan_period" defaultValue="week" title="ວິທີໃສ່ແຜນຂາຍ: ລາຍອາທິດ ຫຼື ລາຍເດືອນ (1 ຄ່າ/4 ອາທິດ)" className={inputCls}>
          <option value="week">ແຜນລາຍອາທິດ</option>
          <option value="month">ແຜນລາຍເດືອນ</option>
        </select>
        <Btn label="ເພີ່ມໂມເດວ" />
        {state.error && <p className="text-xs text-red-600 dark:text-red-400 sm:col-span-2 lg:col-span-5">{state.error}</p>}
        {state.success && <p className="text-xs text-emerald-700 dark:text-emerald-400 sm:col-span-2 lg:col-span-5">{state.success}</p>}
      </form>
      <form action={refreshAction} className="flex items-center gap-2">
        <input type="hidden" name="plan_id" value={planId} />
        <Btn label="⟳ ອັບເດດ Stock ຈາກ ERP" />
        {refreshState.success && <p className="text-xs text-emerald-700 dark:text-emerald-400">{refreshState.success}</p>}
      </form>
    </div>
  );
}
