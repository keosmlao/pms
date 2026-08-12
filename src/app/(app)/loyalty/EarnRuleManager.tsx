"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteEarnRule, saveEarnRule, type ConfigActionState } from "./actions";
import type { BuOption, ChannelOption, EarnRule } from "@/lib/loyalty-config";

const initial: ConfigActionState = { error: null, success: null };

const FIELD =
  "h-10 w-full rounded-lg glass px-3 text-sm text-slate-900 outline-none transition focus:border-teal-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white";
const LABEL = "mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 rounded-lg bg-teal-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-teal-500 disabled:opacity-60"
    >
      {pending ? "..." : label}
    </button>
  );
}

function Notice({ state }: { state: ConfigActionState }) {
  if (!state.error && !state.success) return null;
  return (
    <p
      className={`mt-2 rounded-lg px-3 py-2 text-[11px] font-medium ${
        state.error
          ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
          : "bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-300"
      }`}
    >
      {state.error ?? state.success}
    </p>
  );
}

function RuleForm({
  channels,
  bus,
  rule,
  onDone,
}: {
  channels: ChannelOption[];
  bus: BuOption[];
  rule?: EarnRule;
  onDone?: () => void;
}) {
  const [state, action] = useActionState(saveEarnRule, initial);

  // Close the form once the save succeeds. In an effect, not during render —
  // the parent's setState would otherwise fire mid-render.
  useEffect(() => {
    if (state.success && onDone) onDone();
  }, [state.success, onDone]);

  return (
    <form action={action} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40">
      {rule && <input type="hidden" name="id" value={rule.id} />}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <label className={LABEL} htmlFor="channel_group">ຊ່ອງທາງ</label>
          <select id="channel_group" name="channel_group" defaultValue={rule?.channel_group ?? ""} className={FIELD}>
            <option value="">ທຸກຊ່ອງທາງ</option>
            {channels.map((c) => (
              <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor="bu_code">BU</label>
          <select id="bu_code" name="bu_code" defaultValue={rule?.bu_code ?? ""} className={FIELD}>
            <option value="">ທຸກ BU</option>
            {bus.map((b) => (
              <option key={b.code} value={b.code}>{b.name} ({b.code})</option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor="kip_per_point">ກີບ ຕໍ່ 1 ແຕ້ມ</label>
          <input id="kip_per_point" name="kip_per_point" inputMode="numeric" defaultValue={rule?.kip_per_point ?? "50000"} className={FIELD} />
        </div>
        <div>
          <label className={LABEL} htmlFor="multiplier">ຕົວຄູນ</label>
          <input id="multiplier" name="multiplier" inputMode="decimal" defaultValue={rule?.multiplier ?? "1"} className={FIELD} />
        </div>
        <div>
          <label className={LABEL} htmlFor="from_date">ວັນເລີ່ມ</label>
          <input id="from_date" name="from_date" type="date" defaultValue={rule?.from_date ?? ""} className={FIELD} />
        </div>
        <div>
          <label className={LABEL} htmlFor="to_date">ວັນສິ້ນສຸດ (ວ່າງ = ບໍ່ມີ)</label>
          <input id="to_date" name="to_date" type="date" defaultValue={rule?.to_date ?? ""} className={FIELD} />
        </div>
        <div className="xl:col-span-2">
          <label className={LABEL} htmlFor="note">ໝາຍເຫດ</label>
          <input id="note" name="note" maxLength={255} defaultValue={rule?.note ?? ""} className={FIELD} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
          <input type="checkbox" name="is_active" defaultChecked={rule ? rule.is_active === 1 : true} className="h-4 w-4 accent-teal-600" />
          ໃຊ້ງານ
        </label>
        <SubmitButton label={rule ? "ບັນທຶກ" : "ເພີ່ມກົດ"} />
        {rule && onDone && (
          <button type="button" onClick={onDone} className="h-10 rounded-lg border border-slate-200 px-4 text-xs font-medium text-slate-600 transition hover:bg-white dark:border-slate-700 dark:text-slate-300">
            ຍົກເລີກ
          </button>
        )}
      </div>
      <Notice state={state} />
    </form>
  );
}

function DeleteForm({ id }: { id: string }) {
  const [state, action] = useActionState(deleteEarnRule, initial);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-[11px] font-medium text-red-600 hover:underline dark:text-red-400">
        ລຶບ
      </button>
      {state.error && <span className="ml-2 text-[10px] text-red-600">{state.error}</span>}
    </form>
  );
}

export default function EarnRuleManager({
  rules,
  channels,
  bus,
  canEditAll,
}: {
  rules: EarnRule[];
  channels: ChannelOption[];
  bus: BuOption[];
  canEditAll: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="mt-4 overflow-hidden rounded-xl glass shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">ອັດຕາການສະສົມແຕ້ມ · {rules.length} ກົດ</h2>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            ກົດທີ່ເຈາະຈົງກວ່າມາກ່ອນ: ຊ່ອງທາງ+BU → ຊ່ອງທາງ → ທຸກຊ່ອງທາງ
            {!canEditAll && " · ທ່ານແກ້ໄດ້ສະເພາະຊ່ອງທາງທີ່ຮັບຜິດຊອບ"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setAdding((v) => !v); setEditing(null); }}
          className="h-9 rounded-lg bg-teal-600 px-3 text-xs font-bold text-white shadow-sm transition hover:bg-teal-500"
        >
          {adding ? "ປິດ" : "+ ເພີ່ມກົດ"}
        </button>
      </div>

      {adding && (
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <RuleForm channels={channels} bus={bus} onDone={() => setAdding(false)} />
        </div>
      )}

      {rules.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-400">ຍັງບໍ່ມີກົດ — ກົດ &quot;+ ເພີ່ມກົດ&quot; ເພື່ອສ້າງອັນທຳອິດ</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-[10px] uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950/40">
                <th className="px-4 py-2.5 font-semibold">ຊ່ອງທາງ</th>
                <th className="px-4 py-2.5 font-semibold">BU</th>
                <th className="px-4 py-2.5 text-right font-semibold">ກີບ/ແຕ້ມ</th>
                <th className="px-4 py-2.5 text-right font-semibold">ຕົວຄູນ</th>
                <th className="px-4 py-2.5 font-semibold">ໄລຍະ</th>
                <th className="px-4 py-2.5 font-semibold">ສະຖານະ</th>
                <th className="px-4 py-2.5 font-semibold">ໝາຍເຫດ</th>
                <th className="px-4 py-2.5 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0 align-top dark:border-slate-800">
                  <td className="px-4 py-2 font-semibold text-slate-800 dark:text-slate-100">{r.channel_name}</td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{r.bu_name}</td>
                  <td className="px-4 py-2 text-right font-semibold text-slate-800 dark:text-slate-100">
                    {Number(r.kip_per_point).toLocaleString("en-US")}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-300">×{Number(r.multiplier)}</td>
                  <td className="px-4 py-2 text-[11px] text-slate-500">{r.from_date} → {r.to_date ?? "ບໍ່ມີກຳນົດ"}</td>
                  <td className="px-4 py-2 text-xs">
                    {r.is_active === 1
                      ? <span className="text-teal-600 dark:text-teal-400">ໃຊ້ງານ</span>
                      : <span className="text-slate-400">ປິດ</span>}
                  </td>
                  <td className="px-4 py-2 text-[11px] text-slate-500"><span className="block max-w-xs truncate" title={r.note}>{r.note || "-"}</span></td>
                  <td className="whitespace-nowrap px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => { setEditing(editing === r.id ? null : r.id); setAdding(false); }}
                      className="mr-3 text-[11px] font-medium text-teal-700 hover:underline dark:text-teal-400"
                    >
                      {editing === r.id ? "ປິດ" : "ແກ້ໄຂ"}
                    </button>
                    <DeleteForm id={r.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="border-t border-slate-200 p-4 dark:border-slate-800">
          <RuleForm
            channels={channels}
            bus={bus}
            rule={rules.find((r) => r.id === editing)}
            onDone={() => setEditing(null)}
          />
        </div>
      )}
    </div>
  );
}
