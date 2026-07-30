"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import AsyncSelect from "@/components/ClientAsyncSelect";
import { createPrAction, type PrState } from "./actions";

type ItemOpt = { value: string; label: string; name: string; unit: string; price: number };
type Line = { id: number; item_code: string; item_name: string; unit: string; qty: number; est_price: number; note: string };

let seq = 1;
const blank = (): Line => ({ id: seq++, item_code: "", item_name: "", unit: "", qty: 1, est_price: 0, note: "" });
const money = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

const selectCls = {
  control: ({ isFocused }: { isFocused: boolean }) => ["min-h-8 rounded-md border bg-white px-1 text-xs dark:bg-slate-950", isFocused ? "border-teal-500" : "border-slate-300 dark:border-slate-700"].join(" "),
  valueContainer: () => "px-2 py-0.5", placeholder: () => "text-slate-400", input: () => "text-slate-900 dark:text-white", singleValue: () => "text-slate-900 dark:text-white",
  menu: () => "mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900", menuList: () => "max-h-64 py-1",
  option: ({ isFocused }: { isFocused: boolean }) => ["cursor-pointer px-3 py-2 text-xs", isFocused ? "bg-teal-50 text-teal-900 dark:bg-slate-800 dark:text-white" : "text-slate-700 dark:text-slate-300"].join(" "),
};
const portal = typeof document !== "undefined" ? document.body : undefined;
const inputCls = "min-h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900 outline-none focus:border-teal-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

function SaveButton({ label, name, primary }: { label: string; name: string; primary?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value="1" disabled={pending}
      className={`rounded-md px-4 py-1.5 text-xs font-bold shadow-sm transition disabled:opacity-60 ${primary ? "bg-teal-600 text-white hover:bg-teal-500" : "border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"}`}>
      {pending ? "..." : label}
    </button>
  );
}

export default function PrForm({ departments, defaultDept, requester }: {
  departments: { code: string; name: string }[];
  defaultDept: string;
  requester: { code: string; name: string };
}) {
  const [state, action] = useActionState<PrState, FormData>(createPrAction, { error: null, id: null });
  const [dept, setDept] = useState(defaultDept ?? "");
  const [needDate, setNeedDate] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([blank()]);

  const loadItems = async (input: string): Promise<ItemOpt[]> => {
    if (!input.trim()) return [];
    const res = await fetch(`/api/po-item-search?q=${encodeURIComponent(input)}`);
    if (!res.ok) return [];
    const rows: { code: string; name: string; unit: string; price: number }[] = await res.json();
    return rows.map((r) => ({ value: r.code, label: `${r.code} · ${r.name}`, name: r.name, unit: r.unit, price: r.price }));
  };

  const setLine = (id: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, blank()]);
  const removeLine = (id: number) => setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.id !== id) : ls));

  const estTotal = useMemo(() => lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.est_price) || 0), 0), [lines]);

  const payload = JSON.stringify({
    department_code: dept, need_date: needDate, note,
    lines: lines.filter((l) => l.item_name.trim() && l.qty > 0).map(({ item_code, item_name, unit, qty, est_price, note }) => ({ item_code, item_name, unit, qty, est_price, note })),
  });

  return (
    <form action={action} className="w-full pb-10 text-xs">
      <input type="hidden" name="payload" value={payload} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SaveButton label="ບັນທຶກຮ່າງ" name="draft" />
          <SaveButton label="ບັນທຶກ & ຂໍອະນຸມັດ" name="submit" primary />
          <Link href="/purchase-requisition" className="px-3 py-2 text-slate-500 hover:text-slate-700 dark:text-slate-400">ຍົກເລີກ</Link>
        </div>
      </div>

      {state.error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">{state.error}</div>}

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="px-5 pt-4 pb-2">
          <p className="text-[11px] uppercase tracking-widest text-slate-400">ໃບຂໍຊື້ / Requisition</p>
          <h1 className="mt-0.5 text-lg font-bold text-slate-900 dark:text-white">ໃໝ່</h1>
        </div>

        <div className="grid gap-x-10 gap-y-3 border-t border-slate-100 px-5 py-4 dark:border-slate-800 md:grid-cols-2">
          <label className="grid grid-cols-[110px_1fr] items-center gap-3"><span className="text-slate-500 dark:text-slate-400">ພະແນກ</span>
            <select value={dept} onChange={(e) => setDept(e.target.value)} className={inputCls}><option value="">— ເລືອກພະແນກ —</option>{departments.map((d) => <option key={d.code} value={d.code}>{d.code} · {d.name}</option>)}</select>
          </label>
          <label className="grid grid-cols-[110px_1fr] items-center gap-3"><span className="text-slate-500 dark:text-slate-400">ວັນທີຕ້ອງການ</span>
            <input type="date" value={needDate} onChange={(e) => setNeedDate(e.target.value)} className={inputCls} />
          </label>
          <div className="grid grid-cols-[110px_1fr] items-center gap-3"><span className="text-slate-500 dark:text-slate-400">ຜູ້ຮ້ອງຂໍ</span><span className="text-slate-600 dark:text-slate-300">{requester.name} · {requester.code}</span></div>
        </div>

        {/* lines */}
        <div className="border-t border-slate-100 px-2 pb-2 dark:border-slate-800 sm:px-5">
          <div className="border-b border-slate-200 pb-2 pt-4 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">ລາຍການທີ່ຂໍ</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs">
              <thead><tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-3 font-medium">ສິນຄ້າ / ໂມເດວ</th>
                <th className="px-2 py-2 font-medium" style={{ width: "84px" }}>ໜ່ວຍ</th>
                <th className="px-2 py-2 text-right font-medium" style={{ width: "88px" }}>ຈຳນວນ</th>
                <th className="px-2 py-2 text-right font-medium" style={{ width: "110px" }}>ລາຄາປະມານ</th>
                <th className="px-2 py-2 text-right font-medium" style={{ width: "110px" }}>ລວມ</th>
                <th className="w-8" />
              </tr></thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-t border-slate-50 align-top dark:border-slate-800/60">
                    <td className="py-2 pr-3">
                      <AsyncSelect<ItemOpt>
                        instanceId={`pr-item-${l.id}`}
                        value={l.item_code ? { value: l.item_code, label: `${l.item_code} · ${l.item_name}`, name: l.item_name, unit: l.unit, price: l.est_price } : null}
                        onChange={(v) => v && setLine(l.id, { item_code: v.value, item_name: v.name, unit: v.unit, est_price: l.est_price || v.price })}
                        loadOptions={loadItems}
                        placeholder="ຄົ້ນຫາສິນຄ້າ ຫຼື ພິມຊື່..."
                        noOptionsMessage={({ inputValue }) => (inputValue ? "ບໍ່ພົບ — ໃຊ້ຊື່ນີ້ໄດ້" : "ພິມເພື່ອຄົ້ນຫາ")}
                        onInputChange={(txt, meta) => { if (meta.action === "input-change" && txt) setLine(l.id, { item_name: txt, item_code: "" }); return txt; }}
                        menuPortalTarget={portal} unstyled classNames={selectCls} styles={{ menuPortal: (b) => ({ ...b, zIndex: 60 }) }}
                      />
                      {!l.item_code && l.item_name && <p className="mt-0.5 text-[10px] text-amber-600">ໂມເດວໃໝ່: {l.item_name}</p>}
                    </td>
                    <td className="px-2 py-2"><input value={l.unit} onChange={(e) => setLine(l.id, { unit: e.target.value })} className={inputCls} /></td>
                    <td className="px-2 py-2"><input type="number" min={0} value={l.qty} onChange={(e) => setLine(l.id, { qty: Number(e.target.value) })} className={`${inputCls} text-right tabular-nums`} /></td>
                    <td className="px-2 py-2"><input type="number" min={0} step="0.01" value={l.est_price} onChange={(e) => setLine(l.id, { est_price: Number(e.target.value) })} className={`${inputCls} text-right tabular-nums`} /></td>
                    <td className="px-2 py-2 text-right font-medium tabular-nums text-slate-800 dark:text-slate-100">{money((Number(l.qty) || 0) * (Number(l.est_price) || 0))}</td>
                    <td className="py-2 text-center"><button type="button" onClick={() => removeLine(l.id)} className="text-slate-300 transition hover:text-red-500" aria-label="ລຶບ">✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={addLine} className="mt-1 inline-flex items-center gap-1.5 px-1 py-2 text-xs font-semibold text-teal-600 hover:text-teal-500">＋ ເພີ່ມແຖວ</button>
        </div>

        <div className="grid gap-6 border-t border-slate-100 px-5 py-4 dark:border-slate-800 md:grid-cols-2">
          <div><label className="text-[10px] uppercase tracking-widest text-slate-400">ເຫດຜົນ / ໝາຍເຫດ</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></div>
          <div className="md:pl-8"><dl className="space-y-2"><div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900 dark:border-slate-700 dark:text-white"><dt>ລວມປະມານ</dt><dd className="tabular-nums">{money(estTotal)}</dd></div></dl></div>
        </div>
      </div>
    </form>
  );
}
