"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { toggleProductPoint, type ConfigActionState } from "./actions";

const initial: ConfigActionState = { error: null, success: null };

function ToggleButton({ on }: { on: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`h-7 rounded-lg px-2.5 text-[11px] font-bold transition disabled:opacity-60 ${
        on
          ? "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          : "bg-teal-600 text-white hover:bg-teal-500"
      }`}
    >
      {pending ? "..." : on ? "ເອົາອອກ" : "ໃສ່ຮ່ວມ"}
    </button>
  );
}

// One form per product row. The reason box only appears once the user starts a
// change, so the table stays readable.
export default function ProductPointToggle({
  icCode,
  havePoint,
  disabled,
}: {
  icCode: string;
  havePoint: number;
  disabled: boolean;
}) {
  const [state, action] = useActionState(toggleProductPoint, initial);
  const [reason, setReason] = useState("");
  const on = havePoint === 1;

  if (disabled) {
    return <span className="text-[10px] text-slate-400">ຕ້ອງ migration 004</span>;
  }

  return (
    <form action={action} className="flex flex-wrap items-center justify-end gap-1.5">
      <input type="hidden" name="ic_code" value={icCode} />
      <input type="hidden" name="next" value={on ? "0" : "1"} />
      <input
        name="reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="ເຫດຜົນ"
        maxLength={255}
        className="h-7 w-28 rounded-lg glass px-2 text-[11px] text-slate-900 outline-none focus:border-teal-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
      />
      <ToggleButton on={on} />
      {state.error && <span className="w-full text-right text-[10px] text-red-600">{state.error}</span>}
      {state.success && <span className="w-full text-right text-[10px] text-teal-600">{state.success}</span>}
    </form>
  );
}
