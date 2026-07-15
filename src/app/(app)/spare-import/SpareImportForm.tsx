"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { importSpareMappings, type ImportState } from "./actions";

const initial: ImportState = { error: null, summary: null, skipped: [] };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-500 disabled:opacity-60"
    >
      {pending ? "ກຳລັງຜູກ..." : "ຜູກອາໄຫຼ່"}
    </button>
  );
}

export default function SpareImportForm() {
  const [state, action] = useActionState(importSpareMappings, initial);
  const totalLinked = state.summary?.reduce((s, r) => s + r.linked, 0) ?? 0;

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="data" className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          ວາງຂໍ້ມູນຈາກ Excel (ໜຶ່ງແຖວ = ໜຶ່ງອາໄຫຼ່)
        </label>
        <textarea
          id="data"
          name="data"
          rows={10}
          placeholder={"140101-2467  ຊື່ອາໄຫຼ່... AS-09CR4RYRCB00C AS-12CR4RGCB01 AS-18CR4RXSCB00\n140101-2576  ...  AS-12TR4RYRCA05 AS-09TR4RYRCA00"}
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-xs text-slate-900 outline-none transition focus:border-teal-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        />
        <p className="mt-1 text-[11px] text-slate-400">
          ແຕ່ລະແຖວ: ລະຫັດອາໄຫຼ່ (000000-0000) + ລຸ້ນ AS-xxx ຫຼາຍລຸ້ນ. ຂ້າມ [SET] ແລະ MOCKUP ອັດຕະໂນມັດ.
        </p>
      </div>
      <SubmitButton />

      {state.error && <p className="text-sm font-medium text-red-600 dark:text-red-400">{state.error}</p>}

      {state.summary && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            ຜົນ: ຜູກ {totalLinked.toLocaleString("en-US")} ຄູ່ ຈາກ {state.summary.length} ອາໄຫຼ່
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {state.summary.map((r) => (
              <li key={r.spare} className="flex justify-between gap-3 text-slate-600 dark:text-slate-300">
                <span className="font-mono">{r.spare}</span>
                <span>ຜູກ {r.linked} · {r.models} ລຸ້ນ</span>
              </li>
            ))}
          </ul>
          {state.skipped.length > 0 && (
            <div className="mt-3 border-t border-slate-200 pt-2 dark:border-slate-800">
              <p className="text-xs font-semibold text-amber-600">ຂ້າມ {state.skipped.length} ແຖວ:</p>
              <ul className="mt-1 space-y-0.5 text-[11px] text-slate-400">
                {state.skipped.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
