"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { addPlanItem, type PlanState } from "../purchase-plan/actions";

const initial: PlanState = { error: null, success: null };

function Submit({ added }: { added: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || added}
      className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-semibold transition ${
        added
          ? "border-emerald-300 bg-emerald-50 text-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/40"
          : "border-slate-200 text-slate-600 hover:border-teal-300 hover:text-teal-700 dark:border-slate-700 dark:text-slate-300"
      }`}
    >
      {added ? "✓ ໃນແຜນ" : pending ? "..." : "+ ແຜນ"}
    </button>
  );
}

export default function AddToPlanButton({ code, suggested }: { code: string; suggested: number }) {
  const [state, action] = useActionState(addPlanItem, initial);
  const [qty, setQty] = useState(suggested > 0 ? String(suggested) : "1");

  return (
    <form action={action} className="flex items-center justify-end gap-1">
      <input type="hidden" name="item_code" value={code} />
      <input
        type="number"
        name="plan_qty"
        min={0}
        step="1"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        disabled={!!state.success}
        aria-label="ຈຳນວນສັ່ງ"
        className="w-16 rounded-md border border-slate-200 bg-white px-2 py-1 text-right text-xs text-slate-900 outline-none focus:border-teal-400 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
      />
      <Submit added={!!state.success} />
    </form>
  );
}
