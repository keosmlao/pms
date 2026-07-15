"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { markSamsungClaim, type ClaimState } from "./actions";

const initialState: ClaimState = { error: null, success: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="min-h-9 rounded-lg bg-teal-600 px-3 text-[11px] font-bold text-white hover:bg-teal-500 disabled:opacity-60">{pending ? "ກຳລັງບັນທຶກ..." : "ຢືນຢັນເຄມ"}</button>;
}

export default function ClaimProcess({ serialNo }: { serialNo: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(markSamsungClaim, initialState);

  if (state.success) return <span className="text-[10px] font-semibold text-emerald-600">✓ {state.success}</span>;

  return <div className="min-w-56">
    <button type="button" onClick={() => setOpen((value) => !value)} className="rounded-lg border border-teal-200 px-3 py-1.5 text-[10px] font-bold text-teal-700 transition hover:bg-teal-50 dark:border-teal-800 dark:text-teal-300 dark:hover:bg-teal-950">{open ? "ຍົກເລີກ" : "ເລີ່ມ Process ເຄມ"}</button>
    {open && <form action={action} className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-950">
      <input type="hidden" name="serial_no" value={serialNo} />
      <textarea name="claim_note" required rows={2} defaultValue="ເອົາໄປເຄມແລ້ວ" aria-label="ໝາຍເຫດເຄມ" className="w-full resize-none rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-800 outline-none focus:border-teal-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
      <SubmitButton />
      {state.error && <p className="text-[10px] text-red-600">{state.error}</p>}
    </form>}
  </div>;
}
