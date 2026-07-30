"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createCatalog, type CatalogState } from "./actions";

const initial: CatalogState = { error: null, success: null };
const inputCls =
  "min-h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-teal-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

function Btn() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="rounded-lg bg-teal-600 px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-teal-500 disabled:opacity-60">{pending ? "..." : "ສ້າງແຄັດຕາລ໊ອກ"}</button>;
}

export default function CreateCatalogForm() {
  const [state, action] = useActionState(createCatalog, initial);
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-[2fr_1fr_auto]">
      <input name="title" placeholder="ຊື່ແຄັດຕາລ໊ອກ ເຊັ່ນ ໂປຣໂມຊັນ Samsung ເດືອນ 7" className={inputCls} />
      <select name="currency_code" defaultValue="02" className={inputCls}>
        <option value="02">ກີບ (LAK)</option>
        <option value="01">ບາດ (THB)</option>
      </select>
      <Btn />
      {state.error && <p className="text-xs text-red-600 dark:text-red-400 sm:col-span-3">{state.error}</p>}
    </form>
  );
}
