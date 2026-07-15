"use client";

import { useActionState } from "react";
import { markOrdered, removePlanItem, type PlanState } from "./actions";

const initial: PlanState = { error: null, success: null };

export default function PlanRowActions({ id }: { id: number }) {
  const [, remove] = useActionState(removePlanItem, initial);
  const [, order] = useActionState(markOrdered, initial);
  return (
    <div className="flex justify-end gap-1">
      <form action={order} className="inline">
        <input type="hidden" name="id" value={id} />
        <button type="submit" className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600 transition hover:border-teal-300 hover:text-teal-700 dark:border-slate-700 dark:text-slate-300">ສັ່ງແລ້ວ</button>
      </form>
      <form action={remove} className="inline">
        <input type="hidden" name="id" value={id} />
        <button type="submit" aria-label="ລຶບ" className="rounded-md px-1.5 text-slate-400 transition hover:text-red-600">✕</button>
      </form>
    </div>
  );
}
