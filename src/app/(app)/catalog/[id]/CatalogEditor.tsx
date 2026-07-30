"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import AsyncSelect from "@/components/ClientAsyncSelect";
import { saveCatalogItems, type CatLine } from "../actions";

type ItemOpt = { value: string; label: string; name: string; unit: string; price: number };
let seq = -1;
type Line = CatLine & { key: number };
const blank = (): Line => ({ key: seq--, item_code: "", name: "", unit: "", price: 0, spec: "" });

const cls = {
  control: ({ isFocused }: { isFocused: boolean }) => ["min-h-8 rounded-md border bg-white px-1 text-xs dark:bg-slate-950", isFocused ? "border-teal-400" : "border-slate-200 dark:border-slate-700"].join(" "),
  valueContainer: () => "px-1.5 py-0.5",
  placeholder: () => "text-slate-400",
  input: () => "text-slate-900 dark:text-white",
  singleValue: () => "text-slate-900 dark:text-white",
  menu: () => "mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900 z-50",
  menuList: () => "max-h-60 py-1",
  option: ({ isFocused }: { isFocused: boolean }) => ["cursor-pointer px-3 py-2 text-xs", isFocused ? "bg-slate-100 dark:bg-slate-800" : "text-slate-700 dark:text-slate-300"].join(" "),
};
const inCls = "h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900 outline-none focus:border-teal-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

export default function CatalogEditor({ catalogId, currency, channel, initialLines }: { catalogId: number; currency: string; channel: string; initialLines: CatLine[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [lines, setLines] = useState<Line[]>(initialLines.length ? initialLines.map((l) => ({ ...l, key: seq-- })) : [blank()]);
  const [msg, setMsg] = useState<string | null>(null);

  const setLine = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, blank()]);
  const removeLine = (key: number) => setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : [blank()]));

  const loadItems = async (input: string): Promise<ItemOpt[]> => {
    if (!input.trim()) return [];
    const res = await fetch(`/api/catalog-item-search?q=${encodeURIComponent(input)}&cur=${currency}&channel=${channel}`);
    if (!res.ok) return [];
    const rows: { code: string; name: string; unit: string; price: number }[] = await res.json();
    return rows.map((r) => ({ value: r.code, label: `${r.code} · ${r.name}`, name: r.name, unit: r.unit, price: r.price }));
  };

  const save = () => {
    startTransition(async () => {
      const payload: CatLine[] = lines.map(({ key, ...l }) => { void key; return l; });
      const res = await saveCatalogItems(catalogId, payload);
      if (res.error) setMsg(res.error);
      else { setMsg(res.success); router.refresh(); }
    });
  };

  return (
    <div className="mt-5 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">ສິນຄ້າໃນແຄັດຕາລ໊ອກ · {lines.filter((l) => l.name.trim()).length}</h2>
        <button onClick={addLine} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-teal-300 hover:text-teal-700 dark:border-slate-700 dark:text-slate-300">+ ເພີ່ມສິນຄ້າ</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[10px] uppercase text-slate-500 dark:border-slate-800">
              <th className="px-3 py-2 font-semibold">#</th>
              <th className="px-3 py-2 font-semibold">ສິນຄ້າ</th>
              <th className="w-64 px-2 py-2 font-semibold">ຄຸນສົມບັດຫຍໍ້ (spec)</th>
              <th className="w-16 px-2 py-2 font-semibold">ໜ່ວຍ</th>
              <th className="w-32 px-2 py-2 text-right font-semibold">ລາຄາ</th>
              <th className="w-8 px-1 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.key} className="border-b border-slate-100 align-top dark:border-slate-800">
                <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                <td className="px-3 py-2">
                  <AsyncSelect<ItemOpt>
                    instanceId={`c-item-${l.key}`}
                    value={l.name ? { value: l.item_code, label: l.name, name: l.name, unit: l.unit, price: l.price } : null}
                    onChange={(v) => v && setLine(l.key, { item_code: v.value, name: v.name, unit: v.unit, price: l.price || v.price })}
                    loadOptions={loadItems}
                    placeholder="ຄົ້ນຫາສິນຄ້າ..."
                    noOptionsMessage={({ inputValue }) => (inputValue ? "ບໍ່ພົບ" : "ພິມເພື່ອຄົ້ນຫາ")}
                    menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                    unstyled classNames={cls} styles={{ menuPortal: (b) => ({ ...b, zIndex: 60 }) }}
                  />
                  <input value={l.name} onChange={(e) => setLine(l.key, { name: e.target.value })} placeholder="ຫຼື ພິມຊື່ເອງ" className="mt-1 h-7 w-full rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-700 outline-none focus:border-teal-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200" />
                </td>
                <td className="px-2 py-2"><input value={l.spec} onChange={(e) => setLine(l.key, { spec: e.target.value })} placeholder="ເຊັ່ນ 7.3 ຄິວ · Inverter · ຮັບປະກັນ 10 ປີ" className={inCls} /></td>
                <td className="px-2 py-2"><input value={l.unit} onChange={(e) => setLine(l.key, { unit: e.target.value })} className={inCls} /></td>
                <td className="px-2 py-2"><input type="number" min={0} value={l.price} onChange={(e) => setLine(l.key, { price: Number(e.target.value) })} className={`${inCls} text-right tabular-nums`} /></td>
                <td className="px-1 py-2"><button onClick={() => removeLine(l.key)} className="text-slate-300 hover:text-red-500">✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
        {msg && <span className="text-xs text-slate-500">{msg}</span>}
        <a href={`/catalog-print/${catalogId}`} target="_blank" className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:border-teal-300 hover:text-teal-700 dark:border-slate-700 dark:text-slate-200">🖨 ເບິ່ງ/ພິມ PDF</a>
        <button onClick={save} disabled={pending} className="rounded-lg bg-teal-600 px-6 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-teal-500 disabled:opacity-50">{pending ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ"}</button>
      </div>
    </div>
  );
}
