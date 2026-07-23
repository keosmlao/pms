"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function WarehouseSelect({
  warehouses,
  selected,
  scope,
}: {
  warehouses: { code: string; name: string }[];
  selected: string[];
  scope: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<string[]>(selected);

  const toggle = (code: string) =>
    setSel((s) => (s.includes(code) ? s.filter((c) => c !== code) : [...s, code]));

  const apply = (next: string[]) => {
    const p = new URLSearchParams();
    if (scope && scope !== "all") p.set("scope", scope);
    if (next.length) p.set("wh", next.join(","));
    router.push(`/home${p.toString() ? `?${p}` : ""}`);
    setOpen(false);
  };

  const label =
    selected.length === 0
      ? "— ທຸກສາງ —"
      : selected.length === 1
        ? selected[0]
        : `${selected.length} ສາງ`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setSel(selected);
          setOpen((o) => !o);
        }}
        className={`flex h-9 min-w-[9rem] items-center justify-between gap-2 rounded-lg border px-2.5 text-xs outline-none transition focus:border-teal-400 ${
          selected.length ? "border-teal-400 text-teal-700 dark:text-teal-300" : "border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200"
        } bg-white dark:bg-slate-950`}
      >
        <span className="truncate">{label}</span>
        <svg className="h-3.5 w-3.5 shrink-0 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-20 mt-1 w-72 rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <div className="max-h-60 overflow-auto">
              {warehouses.map((w) => {
                const on = sel.includes(w.code);
                return (
                  <label
                    key={w.code}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(w.code)}
                      className="h-3.5 w-3.5 accent-teal-600"
                    />
                    <span className="font-mono text-[11px] text-slate-400">{w.code}</span>
                    <span className="truncate text-slate-700 dark:text-slate-200">{w.name}</span>
                  </label>
                );
              })}
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
              <button
                type="button"
                onClick={() => apply([])}
                className="rounded-md px-2 py-1.5 text-[11px] font-medium text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                ລ້າງທັງໝົດ
              </button>
              <button
                type="button"
                onClick={() => apply(sel)}
                className="rounded-md bg-teal-600 px-3.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-teal-500"
              >
                ນຳໃຊ້{sel.length ? ` (${sel.length})` : ""}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
