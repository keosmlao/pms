"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { saveTierRule, setTierOverride, type ConfigActionState } from "./actions";

const initial: ConfigActionState = { error: null, success: null };

function Saving({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-8 rounded-lg bg-teal-600 px-3 text-[11px] font-bold text-white transition hover:bg-teal-500 disabled:opacity-60"
    >
      {pending ? "..." : label}
    </button>
  );
}

function Msg({ state }: { state: ConfigActionState }) {
  if (!state.error && !state.success) return null;
  return (
    <span className={`ml-2 text-[10px] ${state.error ? "text-red-600" : "text-teal-600"}`}>
      {state.error ?? state.success}
    </span>
  );
}

// Threshold editor for one tier. Admin-only; the server re-checks.
export function TierRuleRow({
  id,
  minPoints,
  isActive,
  note,
  disabled,
}: {
  id: string;
  minPoints: number;
  isActive: number;
  note: string;
  disabled: boolean;
}) {
  const [state, action] = useActionState(saveTierRule, initial);
  if (disabled) return <span className="text-[10px] text-slate-400">ສະເພາະ admin</span>;

  return (
    <form action={action} className="flex flex-wrap items-center gap-1.5">
      <input type="hidden" name="id" value={id} />
      <input
        name="min_points"
        defaultValue={String(minPoints)}
        inputMode="numeric"
        className="h-8 w-24 rounded-lg glass px-2 text-right text-[11px] text-slate-900 outline-none focus:border-teal-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
      />
      <input
        name="note"
        defaultValue={note}
        maxLength={255}
        placeholder="ໝາຍເຫດ"
        className="h-8 w-40 rounded-lg glass px-2 text-[11px] text-slate-900 outline-none focus:border-teal-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
      />
      <label className="inline-flex cursor-pointer items-center gap-1 text-[10px] text-slate-600 dark:text-slate-300">
        <input type="checkbox" name="is_active" defaultChecked={isActive === 1} className="h-3.5 w-3.5 accent-teal-600" />
        ໃຊ້
      </label>
      <Saving label="ບັນທຶກ" />
      <Msg state={state} />
    </form>
  );
}

// Per-customer override. An empty tier clears it and returns the customer to
// the threshold rules.
export function TierOverrideForm({
  custCode,
  year,
  current,
  levels,
  disabled,
}: {
  custCode: string;
  year: number;
  current: string;
  levels: { code: string; name: string }[];
  disabled: boolean;
}) {
  const [state, action] = useActionState(setTierOverride, initial);
  if (disabled) return null;

  return (
    <form action={action} className="flex flex-wrap items-center justify-end gap-1.5">
      <input type="hidden" name="cust_code" value={custCode} />
      <input type="hidden" name="year" value={year} />
      <select
        name="tier_code"
        defaultValue={current}
        className="h-8 rounded-lg glass px-2 text-[11px] text-slate-900 outline-none focus:border-teal-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
      >
        <option value="">ຕາມເກນ</option>
        {levels.map((l) => (
          <option key={l.code} value={l.code}>{l.name}</option>
        ))}
      </select>
      <input
        name="reason"
        maxLength={255}
        placeholder="ເຫດຜົນ"
        className="h-8 w-24 rounded-lg glass px-2 text-[11px] text-slate-900 outline-none focus:border-teal-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
      />
      <Saving label="ຕັ້ງ" />
      <Msg state={state} />
    </form>
  );
}
