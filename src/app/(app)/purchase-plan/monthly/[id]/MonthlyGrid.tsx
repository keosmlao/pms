"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { removeMonthlyItem, saveMonthlyCells, type MonthCell } from "../actions";

export type GridItem = {
  id: number;
  item_code: string;
  name: string;
  brand: string;
  plan: Record<number, number>;
  lastYear: Record<number, number>;
  thisYear: Record<number, number>;
};

const MONTHS = ["ມ.ກ", "ກ.ພ", "ມ.ນ", "ມ.ສ", "ພ.ພ", "ມິ.ຖ", "ກ.ລ", "ສ.ຫ", "ກ.ຍ", "ຕ.ລ", "ພ.ຈ", "ທ.ວ"];

function fmt(n: number) {
  return n ? n.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "0";
}

const cellInputCls =
  "h-7 w-full rounded border border-transparent bg-transparent text-right text-[11px] text-slate-800 outline-none hover:border-slate-200 focus:border-teal-400 focus:bg-white dark:text-slate-100 dark:hover:border-slate-700 dark:focus:bg-slate-950";

export default function MonthlyGrid({
  planId,
  planYear,
  items,
  readOnly = false,
}: {
  planId: number;
  planYear: number;
  items: GridItem[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState<string | null>(null);

  const now = new Date();
  const currentMonth = planYear === now.getFullYear() ? now.getMonth() + 1 : planYear < now.getFullYear() ? 12 : 0;

  const planVal = (it: GridItem, m: number): number => {
    const k = `${it.id}:${m}`;
    if (k in edits) return edits[k];
    return it.plan[m] ?? 0;
  };
  const setPlanVal = (itemId: number, m: number, raw: string) => {
    const qty = raw === "" ? 0 : Number(raw);
    if (!Number.isFinite(qty) || qty < 0) return;
    setEdits((e) => ({ ...e, [`${itemId}:${m}`]: qty }));
    setMsg(null);
  };
  const dirty = Object.keys(edits).length;

  const save = () => {
    const changes: MonthCell[] = Object.entries(edits).map(([k, qty]) => {
      const [itemId, m] = k.split(":");
      return { itemId: Number(itemId), month: Number(m), qty };
    });
    startTransition(async () => {
      const res = await saveMonthlyCells(planId, changes);
      if (res.error) setMsg(res.error);
      else { setEdits({}); setMsg(res.success); router.refresh(); }
    });
  };
  const removeItem = (id: number) => {
    if (!confirm("ລຶບສິນຄ້ານີ້ອອກ?")) return;
    const fd = new FormData();
    fd.set("id", String(id));
    fd.set("plan_id", String(planId));
    startTransition(async () => { await removeMonthlyItem({ error: null, success: null }, fd); router.refresh(); });
  };

  // Fill this year's plan from last year's actual (× growth factor), for empty months only.
  const copyLastYear = (mult: number) => {
    setEdits((e) => {
      const next = { ...e };
      for (const it of items) {
        for (let m = 1; m <= 12; m++) {
          if (planVal(it, m) === 0 && it.lastYear[m]) next[`${it.id}:${m}`] = Math.round(it.lastYear[m] * mult);
        }
      }
      return next;
    });
    setMsg(`ຄັດລອກຈາກປີກ່ອນ ×${mult} ເຂົ້າຊ່ອງທີ່ຫວ່າງແລ້ວ — ກວດ ແລ້ວກົດບັນທຶກ`);
  };

  const rows = useMemo(() => items.map((it) => {
    const planTotal = Array.from({ length: 12 }, (_, i) => planVal(it, i + 1)).reduce((a, b) => a + b, 0);
    const lastTotal = Object.values(it.lastYear).reduce((a, b) => a + b, 0);
    const ytd = Object.entries(it.thisYear).reduce((s, [m, q]) => s + (Number(m) <= currentMonth ? q : 0), 0);
    const planToDate = Array.from({ length: currentMonth }, (_, i) => planVal(it, i + 1)).reduce((a, b) => a + b, 0);
    const pct = planToDate > 0 ? Math.round((ytd / planToDate) * 100) : null;
    return { it, planTotal, lastTotal, ytd, pct };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [items, edits, currentMonth]);

  const grand = useMemo(() => {
    let plan = 0, last = 0, ytd = 0;
    const perMonth = Array(13).fill(0);
    for (const r of rows) { plan += r.planTotal; last += r.lastTotal; ytd += r.ytd; }
    for (const it of items) for (let m = 1; m <= 12; m++) perMonth[m] += planVal(it, m);
    return { plan, last, ytd, perMonth };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, items, edits]);

  return (
    <div>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: `ລວມແຜນຂາຍ ${planYear}`, value: fmt(grand.plan), cls: "text-teal-600 dark:text-teal-400" },
          { label: `ຍອດຂາຍຈິງປີກ່ອນ ${planYear - 1}`, value: fmt(grand.last), cls: "text-slate-900 dark:text-white" },
          { label: `ຍອດຂາຍສະສົມ ${planYear}`, value: fmt(grand.ytd), cls: "text-indigo-600 dark:text-indigo-400" },
          { label: "ບັນລຸແຜນ (ສະສົມ)", value: grand.plan > 0 && currentMonth > 0 ? `${Math.round((grand.ytd / Math.max(1, grand.perMonth.slice(1, currentMonth + 1).reduce((a, b) => a + b, 0))) * 100)}%` : "-", cls: "text-slate-900 dark:text-white" },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">{c.label}</p>
            <p className={`mt-1 text-xl font-bold ${c.cls}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {!readOnly && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">ຄັດລອກຈາກປີກ່ອນ:</span>
          <button type="button" onClick={() => copyLastYear(1)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-teal-300 hover:text-teal-700 dark:border-slate-700 dark:text-slate-300">×1.0 (ເທົ່າເກົ່າ)</button>
          <button type="button" onClick={() => copyLastYear(1.1)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-teal-300 hover:text-teal-700 dark:border-slate-700 dark:text-slate-300">×1.1 (+10%)</button>
          <button type="button" onClick={() => copyLastYear(1.2)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-teal-300 hover:text-teal-700 dark:border-slate-700 dark:text-slate-300">×1.2 (+20%)</button>
          <span className="text-[10px] text-slate-400">(ໃສ່ສະເພາະຊ່ອງທີ່ຍັງຫວ່າງ)</span>
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-[11px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left font-semibold dark:bg-slate-950">ສິນຄ້າ</th>
                {MONTHS.map((mo, i) => (
                  <th key={mo} className={`px-1 py-2 text-right font-semibold ${i + 1 === currentMonth ? "bg-teal-100/70 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" : ""}`}>{mo}</th>
                ))}
                <th className="px-2 py-2 text-right font-semibold">ລວມແຜນ</th>
                <th className="px-2 py-2 text-right font-semibold" title={`ຍອດຂາຍຈິງທັງປີ ${planYear - 1}`}>ປີກ່ອນ</th>
                <th className="px-2 py-2 text-right font-semibold" title={`ຍອດຂາຍສະສົມ ${planYear} ຮອດເດືອນປັດຈຸບັນ`}>ສະສົມ</th>
                <th className="px-1 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ it, planTotal, lastTotal, ytd, pct }) => (
                <tr key={it.id} className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40">
                  <td className="sticky left-0 z-10 bg-white px-3 py-1.5 dark:bg-slate-900">
                    <Link href={`/products/${encodeURIComponent(it.item_code)}`} title={it.name} className="block max-w-[190px] truncate font-semibold text-blue-700 hover:underline dark:text-blue-400">{it.item_code}</Link>
                    <span className="block max-w-[190px] truncate text-[10px] text-slate-400">{it.name}</span>
                  </td>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                    const edited = `${it.id}:${m}` in edits;
                    return (
                      <td key={m} className={`px-0.5 py-0.5 align-top ${m === currentMonth ? "bg-teal-50/60 dark:bg-teal-900/15" : ""}`}>
                        <input
                          type="number"
                          min={0}
                          value={String(planVal(it, m))}
                          disabled={readOnly}
                          onChange={(e) => setPlanVal(it.id, m, e.target.value)}
                          className={`${cellInputCls} ${edited ? "bg-amber-50 font-bold dark:bg-amber-900/30" : ""} ${planVal(it, m) === 0 ? "text-slate-300 dark:text-slate-600" : ""}`}
                        />
                        <div className="pr-1 text-right text-[9px] leading-tight text-slate-400" title={`ຂາຍຈິງ ${MONTHS[m - 1]} ${planYear - 1}`}>{fmt(it.lastYear[m] ?? 0)}</div>
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5 text-right font-bold text-teal-700 dark:text-teal-300">{fmt(planTotal)}</td>
                  <td className="px-2 py-1.5 text-right text-slate-500">{fmt(lastTotal)}</td>
                  <td className="px-2 py-1.5 text-right">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{fmt(ytd)}</span>
                    {pct != null && <span className={`ml-1 text-[9px] ${pct >= 100 ? "text-emerald-600" : pct >= 70 ? "text-amber-600" : "text-red-500"}`}>{pct}%</span>}
                  </td>
                  <td className="px-1 py-1.5">{!readOnly && <button onClick={() => removeItem(it.id)} title="ລຶບ" className="text-slate-300 hover:text-red-500">✕</button>}</td>
                </tr>
              ))}
              <tr className="bg-teal-50/60 font-bold text-slate-900 dark:bg-teal-900/20 dark:text-white">
                <td className="sticky left-0 z-10 bg-teal-50 px-3 py-2 dark:bg-slate-900">TOTAL</td>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <td key={m} className={`px-1 py-2 text-right ${m === currentMonth ? "bg-teal-100/60 dark:bg-teal-900/25" : ""}`}>{fmt(grand.perMonth[m])}</td>
                ))}
                <td className="px-2 py-2 text-right text-teal-700 dark:text-teal-300">{fmt(grand.plan)}</td>
                <td className="px-2 py-2 text-right text-slate-500">{fmt(grand.last)}</td>
                <td className="px-2 py-2 text-right text-indigo-600 dark:text-indigo-400">{fmt(grand.ytd)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="border-t border-slate-100 px-4 py-2 text-[10px] text-slate-400 dark:border-slate-800">ຕົວເລກໃຫຍ່ = ແຜນຂາຍ (ພິມໄດ້) · ຕົວເລກສີເທົາໃຕ້ຊ່ອງ = ຍອດຂາຍຈິງເດືອນນັ້ນ ປີ {planYear - 1} · ຄໍລຳພື້ນຟ້າ = ເດືອນປັດຈຸບັນ</p>
      </div>

      {!readOnly && (
        <div className="sticky bottom-3 mt-4 flex items-center justify-end gap-3">
          {msg && <span className="rounded-lg bg-white/90 px-3 py-1.5 text-xs text-slate-600 shadow dark:bg-slate-900/90 dark:text-slate-300">{msg}</span>}
          {dirty > 0 && <span className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800 shadow dark:bg-amber-900/60 dark:text-amber-200">ແກ້ໄຂ {dirty} ຊ່ອງ ຍັງບໍ່ບັນທຶກ</span>}
          <button onClick={save} disabled={pending || dirty === 0} className="rounded-lg bg-teal-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg transition hover:bg-teal-500 disabled:opacity-40">{pending ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ"}</button>
        </div>
      )}
    </div>
  );
}
