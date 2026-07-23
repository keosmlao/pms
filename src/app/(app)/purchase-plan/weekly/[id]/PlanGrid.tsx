"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { removeWeeklyItem, saveWeeklyCells, type CellChange } from "../actions";

export type GridItem = {
  id: number;
  item_code: string | null;
  model: string;
  grp: string;
  name: string;
  stock: number; // snapshot used for the purchase computation
  liveStock: number | null;
  avgWeekSale: number;
  policyMonths: number | null; // allowed months of stock (DII target)
  cells: Record<string, number>; // `${kind}:${week}` → qty
  actual: Record<number, number>; // week → actual ERP sales qty
};

type Props = {
  planId: number;
  saleWeeks: number[];
  arrivalWeeks: number[];
  items: GridItem[];
  readOnly?: boolean;
  currentWeek?: number;
};

function fmt(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
}
function wkLabel(w: number) {
  return `WK${w > 52 ? w - 52 : w}`;
}

const cellInputCls =
  "h-7 w-12 rounded border border-transparent bg-transparent text-right text-[11px] text-slate-700 outline-none hover:border-slate-200 focus:border-teal-400 focus:bg-white dark:text-slate-200 dark:hover:border-slate-700 dark:focus:bg-slate-950";

export default function PlanGrid({ planId, saleWeeks, arrivalWeeks, items, readOnly = false, currentWeek }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Edited values overlay: key `${itemId}:${kind}:${week}` → qty
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState<string | null>(null);

  const val = (it: GridItem, kind: "sale" | "arrival", week: number): number => {
    const k = `${it.id}:${kind}:${week}`;
    if (k in edits) return edits[k];
    return it.cells[`${kind}:${week}`] ?? 0;
  };

  const setVal = (itemId: number, kind: "sale" | "arrival", week: number, raw: string) => {
    const qty = raw === "" ? 0 : Number(raw);
    if (!Number.isFinite(qty) || qty < 0) return;
    setEdits((e) => ({ ...e, [`${itemId}:${kind}:${week}`]: qty }));
    setMsg(null);
  };

  const dirtyCount = Object.keys(edits).length;

  const save = () => {
    const changes: CellChange[] = Object.entries(edits).map(([k, qty]) => {
      const [itemId, kind, week] = k.split(":");
      return { itemId: Number(itemId), kind: kind as "sale" | "arrival", week: Number(week), qty };
    });
    startTransition(async () => {
      const res = await saveWeeklyCells(planId, changes);
      if (res.error) setMsg(res.error);
      else {
        setEdits({});
        setMsg(res.success);
        router.refresh();
      }
    });
  };

  const removeItem = (id: number) => {
    if (!confirm("ລຶບໂມເດວນີ້ອອກຈາກແຜນ?")) return;
    const fd = new FormData();
    fd.set("id", String(id));
    fd.set("plan_id", String(planId));
    startTransition(async () => {
      await removeWeeklyItem({ error: null, success: null }, fd);
      router.refresh();
    });
  };

  // Projected remaining stock at the end of each sale week:
  // start stock + planned arrivals − sales (actual for past weeks, plan from
  // the current week onward).
  const projStock = useMemo(() => {
    const m = new Map<number, Record<number, number>>();
    for (const it of items) {
      let bal = it.stock;
      const rec: Record<number, number> = {};
      for (const w of saleWeeks) {
        const sold = currentWeek != null && w < currentWeek ? (it.actual[w] ?? 0) : val(it, "sale", w);
        const arr = arrivalWeeks.includes(w) ? val(it, "arrival", w) : 0;
        bal = bal + arr - sold;
        rec[w] = bal;
      }
      m.set(it.id, rec);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, saleWeeks, arrivalWeeks, edits, currentWeek]);

  // Per-item computed figures.
  const computed = useMemo(() => {
    const m = new Map<number, { saleTotal: number; purchase: number; arrivalTotal: number; diff: number }>();
    for (const it of items) {
      const saleTotal = saleWeeks.reduce((s, w) => s + val(it, "sale", w), 0);
      const purchase = Math.max(0, saleTotal - it.stock);
      const arrivalTotal = arrivalWeeks.reduce((s, w) => s + val(it, "arrival", w), 0);
      m.set(it.id, { saleTotal, purchase, arrivalTotal, diff: arrivalTotal - purchase });
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, saleWeeks, arrivalWeeks, edits]);

  const groups = useMemo(() => {
    const gs: { name: string; rows: GridItem[] }[] = [];
    for (const it of items) {
      const name = it.grp || "ອື່ນໆ";
      let g = gs.find((x) => x.name === name);
      if (!g) {
        g = { name, rows: [] };
        gs.push(g);
      }
      g.rows.push(it);
    }
    return gs;
  }, [items]);

  const totals = useMemo(() => {
    let sale = 0, purchase = 0, arrival = 0;
    for (const it of items) {
      const c = computed.get(it.id)!;
      sale += c.saleTotal;
      purchase += c.purchase;
      arrival += c.arrivalTotal;
    }
    return { sale, purchase, arrival, diff: arrival - purchase };
  }, [items, computed]);

  const stickyTh = "sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left font-semibold dark:bg-slate-950";
  const stickyTd = "sticky left-0 z-10 bg-white px-3 py-1.5 dark:bg-slate-900";

  const section = (kind: "sale" | "arrival", weeks: number[], title: string, hint: string) => {
    // Fixed column widths so the sale and arrival tables line up: the lead
    // columns of both tables total 270px, week columns are 52px in both.
    const WEEK_W = 52;
    const lead = kind === "sale" ? [150, 56, 64] : [150, 120];
    const tail = kind === "sale" ? [64, 72, 64, 28] : [64, 72, 28];
    const cols = [...lead, ...weeks.map(() => WEEK_W), ...tail];
    const tableW = cols.reduce((a, b) => a + b, 0);
    return (
    <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-3 dark:border-slate-800 dark:bg-slate-950/40">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h2>
        <p className="text-[10px] text-slate-500">{hint}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="text-[11px]" style={{ tableLayout: "fixed", width: tableW, minWidth: "100%" }}>
          <colgroup>
            {cols.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950">
              <th className={stickyTh}>Model</th>
              {kind === "sale" && <th className="px-2 py-2 text-right font-semibold" title="ຍອດຂາຍສະເລ່ຍ/ອາທິດ 6 ອາທິດຫຼ້າສຸດ (ERP)">ຂາຍ/ອທ</th>}
              {kind === "sale" && <th className="px-2 py-2 text-right font-semibold">Stock</th>}
              {kind === "arrival" && <th className="px-2 py-2 text-right font-semibold">ຕ້ອງສັ່ງ</th>}
              {weeks.map((w) => (
                <th key={w} className={`px-1 py-2 text-right font-semibold ${w === currentWeek ? "bg-teal-100/70 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" : ""}`}>{wkLabel(w)}</th>
              ))}
              <th className="px-2 py-2 text-right font-semibold">ລວມ</th>
              {kind === "sale" && <th className="px-2 py-2 text-right font-semibold" title="ຍອດຂາຍຈິງຈາກ ERP ໃນຊ່ວງແຜນ ແລະ % ທຽບແຜນຮອດອາທິດປັດຈຸບັນ">ຂາຍຈິງ</th>}
              <th className="px-2 py-2 text-right font-semibold">{kind === "sale" ? "ຕ້ອງສັ່ງ" : "ສ່ວນຕ່າງ"}</th>
              <th className="px-1 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const gSale = g.rows.reduce((s, r) => s + computed.get(r.id)!.saleTotal, 0);
              const gPurchase = g.rows.reduce((s, r) => s + computed.get(r.id)!.purchase, 0);
              const gArrival = g.rows.reduce((s, r) => s + computed.get(r.id)!.arrivalTotal, 0);
              return [
                ...g.rows.map((it) => {
                  const c = computed.get(it.id)!;
                  return (
                    <tr key={it.id} className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40">
                      <td className={stickyTd}>
                        {it.item_code ? (
                          <Link href={`/products/${encodeURIComponent(it.item_code)}`} title={it.model} className="block truncate font-semibold text-blue-700 hover:underline dark:text-blue-400">{it.model}</Link>
                        ) : (
                          <span className="block truncate font-semibold text-slate-700 dark:text-slate-200" title={`${it.model} — ຍັງບໍ່ມີໃນ ERP`}>{it.model} <span className="text-[9px] text-amber-600">●NEW</span></span>
                        )}
                      </td>
                      {kind === "sale" && <td className="px-2 py-1.5 text-right text-slate-400">{fmt(it.avgWeekSale)}</td>}
                      {kind === "sale" && (
                        <td className="px-2 py-1.5 text-right text-slate-600 dark:text-slate-300" title={it.liveStock != null ? `Stock ໃນ ERP ຕອນນີ້: ${fmt(it.liveStock)}` : "snapshot"}>
                          {fmt(it.stock)}
                          {it.liveStock != null && it.liveStock !== it.stock && <span className="ml-0.5 text-[9px] text-amber-600">({fmt(it.liveStock)})</span>}
                        </td>
                      )}
                      {kind === "arrival" && <td className="px-2 py-1.5 text-right font-bold text-teal-600 dark:text-teal-400">{fmt(c.purchase)}</td>}
                      {weeks.map((w) => {
                        const k = `${it.id}:${kind}:${w}`;
                        const edited = k in edits;
                        const act = kind === "sale" ? it.actual[w] : undefined;
                        return (
                          <td key={w} className={`px-0.5 py-0.5 text-right align-top ${w === currentWeek ? "bg-teal-50/60 dark:bg-teal-900/15" : ""}`}>
                            <input
                              type="number"
                              min={0}
                              value={String(val(it, kind, w))}
                              disabled={readOnly}
                              onChange={(e) => setVal(it.id, kind, w, e.target.value)}
                              className={`${cellInputCls} ${edited ? "bg-amber-50 font-bold dark:bg-amber-900/30" : ""} ${val(it, kind, w) === 0 ? "text-slate-300 dark:text-slate-600" : ""} disabled:hover:border-transparent`}
                            />
                            {kind === "sale" && (
                              <div className="pr-1 text-right text-[9px] leading-tight text-slate-400" title={`ຂາຍຈິງ ${wkLabel(w)}`}>{fmt(act ?? 0)}</div>
                            )}
                            {kind === "sale" && (() => {
                              const st = projStock.get(it.id)?.[w] ?? 0;
                              // Policy ceiling in units: allowed months × monthly sales rate.
                              const limit = it.policyMonths != null && it.avgWeekSale > 0 ? it.policyMonths * it.avgWeekSale * (52 / 12) : null;
                              const overPolicy = limit != null && st > limit;
                              const cls = st < 0 ? "font-bold text-red-500" : overPolicy ? "font-bold text-amber-600 dark:text-amber-400" : "text-sky-600 dark:text-sky-400";
                              const tip = st < 0
                                ? `ເຄື່ອງຈະຂາດ ${wkLabel(w)}`
                                : overPolicy
                                  ? `ເກີນນະໂຍບາຍ ${it.policyMonths} ເດືອນ (ເພດານ ≈ ${fmt(limit!)})`
                                  : `Stock ຄາດຄະເນທ້າຍ ${wkLabel(w)}`;
                              return (
                                <div className={`pr-1 text-right text-[9px] leading-tight ${cls}`} title={tip}>{fmt(st)}</div>
                              );
                            })()}
                          </td>
                        );
                      })}
                      <td className="px-2 py-1.5 text-right font-bold text-slate-800 dark:text-slate-100">
                        {fmt(kind === "sale" ? c.saleTotal : c.arrivalTotal)}
                      </td>
                      {kind === "sale" && (() => {
                        const actualTotal = saleWeeks.reduce((s, w) => s + (it.actual[w] ?? 0), 0);
                        const planToDate = currentWeek == null ? 0 : saleWeeks.filter((w) => w <= currentWeek).reduce((s, w) => s + val(it, "sale", w), 0);
                        const pct = planToDate > 0 ? Math.round((actualTotal / planToDate) * 100) : null;
                        return (
                          <td className="px-2 py-1.5 text-right">
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">{fmt(actualTotal)}</span>
                            {pct != null && (
                              <span className={`ml-1 text-[9px] ${pct >= 100 ? "text-emerald-600" : pct >= 70 ? "text-amber-600" : "text-red-500"}`}>{pct}%</span>
                            )}
                          </td>
                        );
                      })()}
                      <td className={`px-2 py-1.5 text-right font-bold ${kind === "sale" ? "text-teal-600 dark:text-teal-400" : c.diff === 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {kind === "sale" ? fmt(c.purchase) : (c.diff > 0 ? "+" : "") + fmt(c.diff)}
                      </td>
                      <td className="px-1 py-1.5">
                        {kind === "sale" && !readOnly && (
                          <button onClick={() => removeItem(it.id)} title="ລຶບອອກຈາກແຜນ" className="text-slate-300 hover:text-red-500">✕</button>
                        )}
                      </td>
                    </tr>
                  );
                }),
                <tr key={`sub-${g.name}`} className="border-b border-slate-200 bg-slate-50/80 font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200">
                  <td className={`${stickyTd} bg-slate-50 dark:bg-slate-950`}>{g.name}</td>
                  {kind === "sale" && <td></td>}
                  {kind === "sale" && <td className="px-2 py-1.5 text-right">{fmt(g.rows.reduce((s, r) => s + r.stock, 0))}</td>}
                  {kind === "arrival" && <td className="px-2 py-1.5 text-right">{fmt(gPurchase)}</td>}
                  {weeks.map((w) => (
                    <td key={w} className={`px-1 py-1.5 text-right align-top ${w === currentWeek ? "bg-teal-100/50 dark:bg-teal-900/20" : ""}`}>
                      {fmt(g.rows.reduce((s, r) => s + val(r, kind, w), 0))}
                      {kind === "sale" && (
                        <div className="text-[9px] font-normal leading-tight text-slate-400">{fmt(g.rows.reduce((s, r) => s + (r.actual[w] ?? 0), 0))}</div>
                      )}
                      {kind === "sale" && (() => {
                        const st = g.rows.reduce((s, r) => s + (projStock.get(r.id)?.[w] ?? 0), 0);
                        return <div className={`text-[9px] font-normal leading-tight ${st < 0 ? "text-red-500" : "text-sky-600 dark:text-sky-400"}`}>{fmt(st)}</div>;
                      })()}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-right">{fmt(kind === "sale" ? gSale : gArrival)}</td>
                  {kind === "sale" && <td className="px-2 py-1.5 text-right text-indigo-600 dark:text-indigo-400">{fmt(g.rows.reduce((s, r) => s + saleWeeks.reduce((x, w) => x + (r.actual[w] ?? 0), 0), 0))}</td>}
                  <td className="px-2 py-1.5 text-right">{kind === "sale" ? fmt(gPurchase) : (gArrival - gPurchase > 0 ? "+" : "") + fmt(gArrival - gPurchase)}</td>
                  <td></td>
                </tr>,
              ];
            })}
            <tr className="bg-teal-50/60 font-bold text-slate-900 dark:bg-teal-900/20 dark:text-white">
              <td className={`${stickyTd} bg-teal-50 dark:bg-slate-900`}>TOTAL</td>
              {kind === "sale" && <td></td>}
              {kind === "sale" && <td className="px-2 py-2 text-right">{fmt(items.reduce((s, r) => s + r.stock, 0))}</td>}
              {kind === "arrival" && <td className="px-2 py-2 text-right">{fmt(totals.purchase)}</td>}
              {weeks.map((w) => (
                <td key={w} className={`px-1 py-2 text-right align-top ${w === currentWeek ? "bg-teal-100/60 dark:bg-teal-900/25" : ""}`}>
                  {fmt(items.reduce((s, r) => s + val(r, kind, w), 0))}
                  {kind === "sale" && (
                    <div className="text-[9px] font-normal leading-tight text-slate-500">{fmt(items.reduce((s, r) => s + (r.actual[w] ?? 0), 0))}</div>
                  )}
                  {kind === "sale" && (() => {
                    const st = items.reduce((s, r) => s + (projStock.get(r.id)?.[w] ?? 0), 0);
                    return <div className={`text-[9px] font-normal leading-tight ${st < 0 ? "text-red-500" : "text-sky-600 dark:text-sky-400"}`}>{fmt(st)}</div>;
                  })()}
                </td>
              ))}
              <td className="px-2 py-2 text-right">{fmt(kind === "sale" ? totals.sale : totals.arrival)}</td>
              {kind === "sale" && <td className="px-2 py-2 text-right text-indigo-600 dark:text-indigo-400">{fmt(items.reduce((s, r) => s + saleWeeks.reduce((x, w) => x + (r.actual[w] ?? 0), 0), 0))}</td>}
              <td className={`px-2 py-2 text-right ${kind === "arrival" && totals.diff !== 0 ? "text-red-600" : ""}`}>
                {kind === "sale" ? fmt(totals.purchase) : (totals.diff > 0 ? "+" : "") + fmt(totals.diff)}
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    );
  };

  return (
    <div>
      {/* Summary cards */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "ລວມແຜນຂາຍ", value: fmt(totals.sale), cls: "text-slate-900 dark:text-white" },
          { label: "ລວມຕ້ອງສັ່ງ (ແຜນຂາຍ − Stock)", value: fmt(totals.purchase), cls: "text-teal-600 dark:text-teal-400" },
          { label: "ລວມແຜນເອີ້ນເຄື່ອງເຂົ້າ", value: fmt(totals.arrival), cls: "text-slate-900 dark:text-white" },
          { label: "ສ່ວນຕ່າງ (ເຂົ້າ − ຕ້ອງສັ່ງ)", value: (totals.diff > 0 ? "+" : "") + fmt(totals.diff), cls: totals.diff === 0 ? "text-emerald-600" : "text-red-600" },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">{c.label}</p>
            <p className={`mt-1 text-xl font-bold ${c.cls}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {section("sale", saleWeeks, "ແຜນຂາຍລາຍອາທິດ (Sales Plan)", "ແຕ່ລະຊ່ອງ 3 ແຖວ: ແຜນຂາຍ (ພິມໄດ້) · ສີເທົາ = ຍອດຂາຍຈິງຈາກ ERP · ສີຟ້າ = ສະຕັອກຄົງເຫຼືອຄາດຄະເນທ້າຍອາທິດ (ຕົ້ນງວດ + ເຄື່ອງເຂົ້າຕາມແຜນ − ຍອດຂາຍ, ຕິດລົບ = ສີແດງ ເຄື່ອງຈະຂາດ · ສີເຫຼືອງ = ເກີນນະໂຍບາຍ DII ຂອງຍີ່ຫໍ້) · ຄໍລຳພື້ນຟ້າ = ອາທິດປັດຈຸບັນ")}
      {section("arrival", arrivalWeeks, "ແຜນເອີ້ນເຄື່ອງເຂົ້າ (Arrival Plan)", "ແບ່ງຈຳນວນທີ່ຕ້ອງສັ່ງໃຫ້ເຂົ້າແຕ່ລະອາທິດ · ສ່ວນຕ່າງຄວນເປັນ 0")}

      {/* Save bar */}
      {readOnly ? null : (
      <div className="sticky bottom-3 mt-4 flex items-center justify-end gap-3">
        {msg && <span className="rounded-lg bg-white/90 px-3 py-1.5 text-xs text-slate-600 shadow dark:bg-slate-900/90 dark:text-slate-300">{msg}</span>}
        {dirtyCount > 0 && (
          <span className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800 shadow dark:bg-amber-900/60 dark:text-amber-200">
            ແກ້ໄຂ {dirtyCount} ຊ່ອງ ຍັງບໍ່ບັນທຶກ
          </span>
        )}
        <button
          onClick={save}
          disabled={pending || dirtyCount === 0}
          className="rounded-lg bg-teal-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg transition hover:bg-teal-500 disabled:opacity-40"
        >
          {pending ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ"}
        </button>
      </div>
      )}
    </div>
  );
}
