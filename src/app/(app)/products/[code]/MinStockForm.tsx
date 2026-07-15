"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { setMinStock, type MinStockState } from "./min-stock-actions";

const initial: MinStockState = { error: null, success: null };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-teal-500 disabled:opacity-60"
    >
      {pending ? "..." : "ບັນທຶກ"}
    </button>
  );
}

export default function MinStockForm({
  itemCode,
  current,
  balance,
}: {
  itemCode: string;
  current: number | null;
  balance: number;
}) {
  const [state, action] = useActionState(setMinStock, initial);
  const low = current != null && balance < current;

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="item_code" value={itemCode} />
      <input
        type="number"
        name="min_qty"
        defaultValue={current ?? ""}
        min={0}
        step="1"
        placeholder="ຈຳນວນ min"
        className="min-h-9 w-32 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-teal-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
      />
      <SaveButton />
      {current != null && (
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${low ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"}`}>
          {low ? "ຕໍ່າກວ່າ min" : "ພຽງພໍ"}
        </span>
      )}
      {state.error && <span className="text-xs font-medium text-red-600 dark:text-red-400">{state.error}</span>}
      {state.success && <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{state.success}</span>}
    </form>
  );
}
