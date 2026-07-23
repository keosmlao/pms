"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import AsyncSelect from "@/components/ClientAsyncSelect";
import { createPoAction, type PoState } from "./actions";

type Opt = { value: string; label: string };
type ItemOpt = Opt & {
  name: string;
  unit: string;
  price: number;
  last_buy_date: string | null;
  stand_value: number;
  divide_value: number;
  balance: number;
  max_qty: number | null;
  dii_actual: number | null;
  dii_target: number | null;
};
type Line = {
  id: number;
  item_code: string;
  item_name: string;
  unit: string;
  qty: number;
  price: number;
  wh_code: string;
  stand_value: number;
  divide_value: number;
  balance: number; // current on-hand stock at pick time
  max_qty: number | null; // admin-set max (null = none)
  dii_actual: number | null; // brand months-of-stock at pick time
  dii_target: number | null; // brand DII policy target
  ref_doc_no?: string; // source PR
  ref_line?: number;
};

type Props = {
  warehouses: { code: string; name: string }[];
  departments: { code: string; name: string }[];
  defaultDept: string;
  formats: { code: "POH" | "POT"; label: string; branch: string }[];
  currencies: { code: string; label: string }[];
  vatOptions: { value: string; label: string; type: number; rate: number }[];
  requester: { code: string; name: string };
};

const selectCls = {
  control: ({ isFocused }: { isFocused: boolean }) =>
    ["min-h-7 rounded-md border bg-white px-1 text-xs dark:bg-slate-950", isFocused ? "border-teal-500 ring-1 ring-teal-500/30" : "border-slate-300 dark:border-slate-700"].join(" "),
  valueContainer: () => "px-2 py-0.5",
  placeholder: () => "text-slate-400",
  input: () => "text-slate-900 dark:text-white",
  singleValue: () => "text-slate-900 dark:text-white",
  menu: () => "mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900",
  menuList: () => "max-h-64 py-1",
  option: ({ isFocused }: { isFocused: boolean }) => ["cursor-pointer px-3 py-2 text-xs", isFocused ? "bg-teal-50 text-teal-900 dark:bg-slate-800 dark:text-white" : "text-slate-700 dark:text-slate-300"].join(" "),
};
// Odoo-style underline field: borderless, bottom-border only.
const ulineSelectCls = {
  control: ({ isFocused }: { isFocused: boolean }) =>
    ["min-h-7 border-0 border-b bg-transparent px-0 text-xs rounded-none", isFocused ? "border-teal-500" : "border-slate-300 dark:border-slate-700"].join(" "),
  valueContainer: () => "px-0 py-0.5",
  placeholder: () => "text-slate-400",
  input: () => "text-slate-900 dark:text-white",
  singleValue: () => "text-slate-900 dark:text-white",
  menu: () => "mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900",
  menuList: () => "max-h-64 py-1",
  option: ({ isFocused }: { isFocused: boolean }) => ["cursor-pointer px-3 py-2 text-xs", isFocused ? "bg-teal-50 text-teal-900 dark:bg-slate-800 dark:text-white" : "text-slate-700 dark:text-slate-300"].join(" "),
};
const portal = typeof document !== "undefined" ? document.body : undefined;
const portalStyles = { menuPortal: (b: Record<string, unknown>) => ({ ...b, zIndex: 60 }) };

// Underline input class (Odoo look) shared by header selects/inputs.
const U = "w-full min-h-7 rounded-none border-0 border-b border-slate-300 bg-transparent px-0 text-xs text-slate-900 outline-none transition focus:border-teal-500 dark:border-slate-700 dark:text-white";

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
let seq = 1;
const blankLine = (): Line => ({ id: seq++, item_code: "", item_name: "", unit: "", qty: 1, price: 0, wh_code: "", stand_value: 1, divide_value: 1, balance: 0, max_qty: null, dii_actual: null, dii_target: null, ref_doc_no: "", ref_line: 0 });

function SaveButton({ blocked }: { blocked?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || blocked}
      title={blocked ? "ຕິກຢືນຢັນກ່ອນ ເນື່ອງຈາກມີລາຍການເກີນ max stock" : undefined}
      className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-teal-500 disabled:opacity-60"
    >
      {pending ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ & ຂໍອະນຸມັດ"}
    </button>
  );
}

export default function PoForm({ warehouses, departments, defaultDept, formats, currencies, vatOptions, requester }: Props) {
  const [state, action] = useActionState<PoState, FormData>(createPoAction, { error: null, doc_no: null });

  const [format, setFormat] = useState<"POH" | "POT">("POH");
  const [supplier, setSupplier] = useState<Opt | null>(null);
  const [currency, setCurrency] = useState(currencies[0]?.code ?? "01");
  const [rate, setRate] = useState(1);
  const [vat, setVat] = useState(vatOptions[0]?.value ?? "none");
  const [wh, setWh] = useState(warehouses[0]?.code ?? "");
  const [dept, setDept] = useState(defaultDept ?? "");
  const [eta, setEta] = useState("");
  const [creditDay, setCreditDay] = useState(0);
  const [remark, setRemark] = useState("");
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [mode, setMode] = useState<"new" | "pr">("new");
  const [prMsg, setPrMsg] = useState("");
  const [confirmOver, setConfirmOver] = useState(false);

  // Ordering that would push on-hand stock above the admin-set max → warn (soft block).
  const overMax = (l: Line) =>
    Boolean(l.item_code) && l.max_qty != null && (Number(l.balance) || 0) + (Number(l.qty) || 0) > l.max_qty;
  const overLines = lines.filter(overMax);
  const blocked = overLines.length > 0 && !confirmOver;

  // Brand already holds more months of stock than its DII policy allows →
  // warn (informational, not blocking — MOQ/promo terms can justify it).
  const overDii = (l: Line) =>
    Boolean(l.item_code) && l.dii_actual != null && l.dii_target != null && l.dii_actual > l.dii_target;
  const diiLines = lines.filter(overDii);

  const loadPr = async (input: string): Promise<Opt[]> => {
    if (!input.trim()) return [];
    const res = await fetch(`/api/pr-search?q=${encodeURIComponent(input)}`);
    if (!res.ok) return [];
    const rows: { doc_no: string; supplier_code: string; supplier_name: string; lines: number }[] = await res.json();
    return rows.map((r) => ({ value: r.doc_no, label: `${r.doc_no} · ${r.supplier_name} (${r.lines} ລາຍການ)` }));
  };
  const importPr = async (prNo: string) => {
    setPrMsg("");
    const res = await fetch(`/api/pr-lines?pr=${encodeURIComponent(prNo)}`);
    if (!res.ok) return;
    const data: { supplier_code: string; supplier_name: string; lines: { item_code: string; item_name: string; unit: string; qty: string; price: string; ref_line: number }[] } | null = await res.json();
    if (!data) return;
    if (supplier && supplier.value !== data.supplier_code) {
      setPrMsg(`PR ນີ້ເປັນຂອງ supplier ອື່ນ (${data.supplier_name}) — 1 PO = 1 supplier`);
      return;
    }
    if (!supplier) setSupplier({ value: data.supplier_code, label: `${data.supplier_name} · ${data.supplier_code}` });
    setLines((ls) => {
      const kept = ls.filter((l) => l.item_code);
      const imported: Line[] = data.lines.map((pl) => ({
        id: seq++, item_code: pl.item_code, item_name: pl.item_name, unit: pl.unit,
        qty: Number(pl.qty) || 0, price: Number(pl.price) || 0, wh_code: "",
        stand_value: 1, divide_value: 1, balance: 0, max_qty: null, dii_actual: null, dii_target: null, ref_doc_no: prNo, ref_line: pl.ref_line,
      }));
      const next = [...kept, ...imported];
      return next.length ? next : [blankLine()];
    });
    setPrMsg(`ດຶງ ${data.lines.length} ລາຍການ ຈາກ ${prNo} ແລ້ວ`);
  };

  const loadSuppliers = async (input: string): Promise<Opt[]> => {
    if (!input.trim()) return [];
    const res = await fetch(`/api/supplier-search?q=${encodeURIComponent(input)}`);
    if (!res.ok) return [];
    const rows: { code: string; name: string }[] = await res.json();
    return rows.map((r) => ({ value: r.code, label: `${r.name} · ${r.code}` }));
  };
  const loadItems = async (input: string): Promise<ItemOpt[]> => {
    if (!input.trim()) return [];
    const res = await fetch(`/api/po-item-search?q=${encodeURIComponent(input)}`);
    if (!res.ok) return [];
    const rows: { code: string; name: string; unit: string; price: number; last_buy_date: string | null; stand_value: number; divide_value: number; balance: number; max_qty: number | null; dii_actual: number | null; dii_target: number | null }[] = await res.json();
    return rows.map((r) => ({
      value: r.code,
      label: `${r.code} · ${r.name}${r.price ? `  (ຊື້ລ້າສຸດ ${r.price.toLocaleString("en-US")})` : ""}${r.dii_actual != null && r.dii_target != null && r.dii_actual > r.dii_target ? `  ⚠DII ${r.dii_actual}/${r.dii_target}ດ` : ""}`,
      name: r.name, unit: r.unit, price: r.price, last_buy_date: r.last_buy_date, stand_value: r.stand_value, divide_value: r.divide_value,
      balance: r.balance, max_qty: r.max_qty, dii_actual: r.dii_actual, dii_target: r.dii_target,
    }));
  };

  const setLine = (id: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, blankLine()]);
  const removeLine = (id: number) => setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.id !== id) : ls));

  const today = new Date().toLocaleDateString("en-GB");
  const vatOpt = vatOptions.find((v) => v.value === vat) ?? vatOptions[0];
  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
    let before = subtotal, tax = 0, total = subtotal;
    if (vatOpt.type === 2 && vatOpt.rate > 0) { before = subtotal / (1 + vatOpt.rate / 100); tax = subtotal - before; total = subtotal; }
    else if (vatOpt.type === 1 && vatOpt.rate > 0) { tax = subtotal * (vatOpt.rate / 100); total = subtotal + tax; }
    return { subtotal, before, tax, total };
  }, [lines, vatOpt]);

  const payload = JSON.stringify({
    format,
    supplier_code: supplier?.value ?? "",
    currency_code: currency,
    exchange_rate: rate,
    vat,
    wh_code: wh,
    department_code: dept,
    eta,
    credit_day: creditDay,
    remark,
    lines: lines
      .filter((l) => l.item_code && l.qty > 0)
      .map(({ item_code, item_name, unit, qty, price, wh_code, stand_value, divide_value, ref_doc_no, ref_line }) => ({
        item_code, item_name, unit, qty, price, wh_code: wh_code || wh, stand_value, divide_value,
        ref_doc_no: ref_doc_no ?? "", ref_line: ref_line ?? 0,
      })),
  });

  // ----- success screen -----
  if (state.doc_no) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm dark:border-emerald-500/30 dark:bg-slate-900">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </div>
          <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">ອອກ PO ສຳເລັດ</h2>
          <p className="mt-1 text-xs text-slate-500">ບັນທຶກເຂົ້າ SML ແລ້ວ (ຮ່າງ) — ຂັ້ນຕໍ່ໄປ ແນບແຜນ/ເອກະສານ ແລ້ວຂໍອະນຸມັດ</p>
          <p className="mt-3 font-mono text-lg font-bold text-teal-600">{state.doc_no}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href={`/purchase-order/${encodeURIComponent(state.doc_no)}`} className="rounded-md bg-teal-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-teal-500">ແນບເອກະສານ & ຂໍອະນຸມັດ</Link>
            <Link href="/purchase-order" className="rounded-md border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">ໄປລາຍການ PO</Link>
            <button type="button" onClick={() => { window.location.href = "/purchase-order/new"; }} className="rounded-md border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">ສ້າງໃໝ່</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="w-full pb-10 text-xs">
      <input type="hidden" name="payload" value={payload} />

      {/* Odoo-style control bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <SaveButton blocked={blocked} />
          <Link href="/purchase-order" className="px-3 py-2 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400">ຍົກເລີກ</Link>
        </div>
        {/* statusbar chevron stages */}
        <div className="flex items-center text-[11px] font-semibold">
          {["ຮ່າງ", "ລໍຖ້າອະນຸມັດ", "ອະນຸມັດ"].map((s, i) => (
            <span key={s} className="flex items-center">
              <span className={i === 0 ? "rounded bg-teal-600 px-2.5 py-1 text-white" : "px-2 py-1 text-slate-400"}>{s}</span>
              {i < 2 && <span className="px-0.5 text-slate-300">›</span>}
            </span>
          ))}
        </div>
      </div>

      {state.error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {state.error}
        </div>
      )}

      {overLines.length > 0 && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
          <p className="font-bold">⛔ ເກີນ max stock — {overLines.length} ລາຍການ</p>
          <ul className="mt-1.5 space-y-0.5">
            {overLines.map((l) => (
              <li key={l.id} className="tabular-nums">
                • {l.item_code} · {l.item_name} — ຄົງເຫຼືອ {l.balance.toLocaleString("en-US")} + ສັ່ງ {l.qty.toLocaleString("en-US")} = {(l.balance + l.qty).toLocaleString("en-US")} &gt; max {l.max_qty!.toLocaleString("en-US")}
              </li>
            ))}
          </ul>
          <label className="mt-2 flex items-center gap-2 font-semibold">
            <input type="checkbox" checked={confirmOver} onChange={(e) => setConfirmOver(e.target.checked)} className="h-3.5 w-3.5 accent-amber-600" />
            ຢືນຢັນວ່າຕ້ອງການສັ່ງຊື້ເກີນ max ຈິງ
          </label>
        </div>
      )}

      {diiLines.length > 0 && (
        <div className="mt-4 rounded-md border border-orange-200 bg-orange-50 px-4 py-3 text-xs text-orange-800 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300">
          <p className="font-bold">⚠ ຍີ່ຫໍ້ຖື stock ເກີນນະໂຍບາຍ DII ຢູ່ແລ້ວ — {diiLines.length} ລາຍການ (ເຕືອນເພື່ອຊາບ ບໍ່ໄດ້ບລັອກ)</p>
          <ul className="mt-1.5 space-y-0.5">
            {diiLines.map((l) => (
              <li key={l.id} className="tabular-nums">
                • {l.item_code} · {l.item_name} — DII ຕົວຈິງ {l.dii_actual!.toLocaleString("en-US")} ເດືອນ &gt; ເປົ້າ {l.dii_target!.toLocaleString("en-US")} ເດືອນ
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[10px]">ກວດລາຍລະອຽດນະໂຍບາຍໄດ້ທີ່ ເມນູ ນະໂຍບາຍ Stock</p>
        </div>
      )}

      {/* Odoo "sheet" */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="px-5 pt-4 pb-2">
          <p className="text-[11px] uppercase tracking-widest text-slate-400">ໃບສັ່ງຊື້ / RFQ</p>
          <h1 className="mt-0.5 text-lg font-bold text-slate-900 dark:text-white">ໃໝ່</h1>
        </div>

        {/* source mode: new vs from approved PR */}
        <div className="border-t border-slate-100 px-5 py-3 dark:border-slate-800">
          <div className="flex w-max overflow-hidden rounded-md border border-slate-300 text-[11px] font-semibold dark:border-slate-700">
            <button type="button" onClick={() => setMode("new")} className={`px-3 py-1.5 ${mode === "new" ? "bg-teal-600 text-white" : "bg-white text-slate-500 dark:bg-slate-950 dark:text-slate-400"}`}>ສ້າງໃໝ່</button>
            <button type="button" onClick={() => setMode("pr")} className={`px-3 py-1.5 ${mode === "pr" ? "bg-teal-600 text-white" : "bg-white text-slate-500 dark:bg-slate-950 dark:text-slate-400"}`}>ຈາກ PR (ໃບຂໍຊື້)</button>
          </div>
          {mode === "pr" && (
            <div className="mt-2 max-w-md">
              <AsyncSelect<Opt>
                instanceId="po-pr"
                value={null}
                onChange={(v) => v && importPr(v.value)}
                loadOptions={loadPr}
                placeholder="ຄົ້ນຫາ PR ອະນຸມັດ (ເລກ / supplier / ສິນຄ້າ)..."
                noOptionsMessage={({ inputValue }) => (inputValue ? "ບໍ່ພົບ PR ຄ້າງ" : "ພິມເພື່ອຄົ້ນຫາ")}
                menuPortalTarget={portal} unstyled classNames={selectCls} styles={portalStyles}
              />
              {prMsg && <p className="mt-1 text-[11px] text-teal-600 dark:text-teal-400">{prMsg}</p>}
            </div>
          )}
        </div>

        {/* header fields — Odoo two-group, label-left, underline inputs */}
        <div className="grid gap-x-14 gap-y-2.5 px-5 py-4 md:grid-cols-2">
          <div className="space-y-2.5">
            <Row label="ຜູ້ສະໜອງ" required>
              <AsyncSelect<Opt>
                instanceId="po-supplier"
                value={supplier}
                onChange={(v) => setSupplier(v)}
                loadOptions={loadSuppliers}
                placeholder="ຄົ້ນຫາຜູ້ສະໜອງ..."
                noOptionsMessage={({ inputValue }) => (inputValue ? "ບໍ່ພົບ" : "ພິມເພື່ອຄົ້ນຫາ")}
                menuPortalTarget={portal} unstyled classNames={ulineSelectCls} styles={portalStyles}
              />
            </Row>
            <Row label="ຮູບແບບ / ສາຂາ">
              <div className="flex overflow-hidden rounded-md border border-slate-300 dark:border-slate-700">
                {formats.map((f) => (
                  <button
                    type="button" key={f.code} onClick={() => setFormat(f.code)}
                    className={`flex-1 px-2.5 py-1.5 text-[11px] font-semibold transition ${format === f.code ? "bg-teal-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-950 dark:text-slate-400"}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </Row>
            <Row label="ຄັງເລີ່ມຕົ້ນ">
              <select value={wh} onChange={(e) => setWh(e.target.value)} className={U}>
                <option value="">— ເລືອກຄັງ —</option>
                {warehouses.map((w) => <option key={w.code} value={w.code}>{w.code} · {w.name}</option>)}
              </select>
            </Row>
            <Row label="ພະແນກ">
              <select value={dept} onChange={(e) => setDept(e.target.value)} className={U}>
                <option value="">— ເລືອກພະແນກ —</option>
                {departments.map((d) => <option key={d.code} value={d.code}>{d.code} · {d.name}</option>)}
              </select>
            </Row>
            <Row label="ຜູ້ຮ້ອງຂໍ">
              <span className="text-xs text-slate-600 dark:text-slate-300">{requester.name} · {requester.code}</span>
            </Row>
          </div>

          <div className="space-y-2.5">
            <Row label="ວັນທີເອກະສານ">
              <span className="text-xs text-slate-600 dark:text-slate-300">{today}</span>
            </Row>
            <Row label="ວັນຄາດຮັບເຄື່ອງ">
              <input type="date" value={eta} onChange={(e) => setEta(e.target.value)} className={U} />
            </Row>
            <Row label="ເຄຣดิต (ວັນ)">
              <input type="number" min={0} step="1" value={creditDay} onChange={(e) => setCreditDay(Number(e.target.value))} className={U} />
            </Row>
            <Row label="ສະກຸນເງິນ">
              <div className="flex items-center gap-3">
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={`${U} flex-1`}>
                  {currencies.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
                <input type="number" step="0.0001" min={0} value={rate} onChange={(e) => setRate(Number(e.target.value))} className={`${U} w-24 text-right`} />
              </div>
            </Row>
            <Row label="ພາສີ VAT">
              <select value={vat} onChange={(e) => setVat(e.target.value)} className={U}>
                {vatOptions.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
              </select>
            </Row>
          </div>
        </div>

        {/* line items */}
        <div className="border-t border-slate-100 px-2 pb-2 dark:border-slate-800 sm:px-5">
          <div className="border-b border-slate-200 pb-2 pt-4 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">ລາຍການສິນຄ້າ</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-3 font-medium">ສິນຄ້າ</th>
                  <th className="px-2 py-2 font-medium" style={{ width: "170px" }}>ສາງ (ຮັບເຂົ້າ)</th>
                  <th className="px-2 py-2 font-medium" style={{ width: "84px" }}>ໜ່ວຍ</th>
                  <th className="px-2 py-2 text-right font-medium" style={{ width: "92px" }}>ຈຳນວນ</th>
                  <th className="px-2 py-2 text-right font-medium" style={{ width: "120px" }}>ລາຄາ/ໜ່ວຍ</th>
                  <th className="px-2 py-2 text-right font-medium" style={{ width: "120px" }}>ລວມ</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-t border-slate-50 align-top dark:border-slate-800/60">
                    <td className="py-2 pr-3">
                      <AsyncSelect<ItemOpt>
                        instanceId={`po-item-${l.id}`}
                        value={l.item_code ? { value: l.item_code, label: `${l.item_code} · ${l.item_name}`, name: l.item_name, unit: l.unit, price: l.price, last_buy_date: null, stand_value: l.stand_value, divide_value: l.divide_value, balance: l.balance, max_qty: l.max_qty, dii_actual: l.dii_actual, dii_target: l.dii_target } : null}
                        onChange={(v) => v && setLine(l.id, { item_code: v.value, item_name: v.name, unit: v.unit, price: l.price || v.price, stand_value: v.stand_value, divide_value: v.divide_value, balance: v.balance, max_qty: v.max_qty, dii_actual: v.dii_actual, dii_target: v.dii_target })}
                        loadOptions={loadItems}
                        placeholder="ຄົ້ນຫາສິນຄ້າ..."
                        noOptionsMessage={({ inputValue }) => (inputValue ? "ບໍ່ພົບ" : "ພິມເພື່ອຄົ້ນຫາ")}
                        menuPortalTarget={portal} unstyled classNames={selectCls} styles={portalStyles}
                      />
                      {overDii(l) && (
                        <p className="mt-1 text-[10px] font-medium text-orange-600 dark:text-orange-400" title="ຍີ່ຫໍ້ນີ້ຖື stock ຫຼາຍກວ່ານະໂຍບາຍແລ້ວ">⚠ DII ຍີ່ຫໍ້ {l.dii_actual!.toLocaleString("en-US")} ເດືອນ &gt; ເປົ້າ {l.dii_target!.toLocaleString("en-US")} ເດືອນ</p>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <select value={l.wh_code || wh} onChange={(e) => setLine(l.id, { wh_code: e.target.value })} className="min-h-7 w-full rounded-md border border-slate-200 bg-white px-1 text-[11px] dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                        {warehouses.map((w) => <option key={w.code} value={w.code}>{w.code} · {w.name}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input value={l.unit} onChange={(e) => setLine(l.id, { unit: e.target.value })} className="min-h-7 w-full rounded-md border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" min={0} step="1" value={l.qty} onChange={(e) => setLine(l.id, { qty: Number(e.target.value) })} className={`min-h-7 w-full rounded-md border bg-white px-2 text-right text-xs tabular-nums dark:bg-slate-950 dark:text-white ${overMax(l) ? "border-amber-400 text-amber-700 dark:border-amber-500/60 dark:text-amber-300" : "border-slate-200 dark:border-slate-700"}`} />
                      {overMax(l) && (
                        <p className="mt-1 text-right text-[10px] font-medium text-amber-600 dark:text-amber-400">ເກີນ max {l.max_qty!.toLocaleString("en-US")}</p>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" min={0} step="0.01" value={l.price} onChange={(e) => setLine(l.id, { price: Number(e.target.value) })} className="min-h-7 w-full rounded-md border border-slate-200 bg-white px-2 text-right text-xs tabular-nums dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                    </td>
                    <td className="px-2 py-2 text-right font-medium tabular-nums text-slate-800 dark:text-slate-100">
                      {money((Number(l.qty) || 0) * (Number(l.price) || 0))}
                    </td>
                    <td className="py-2 text-center">
                      <button type="button" onClick={() => removeLine(l.id)} className="text-slate-300 transition hover:text-red-500" aria-label="ລຶບ">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={addLine} className="mt-1 inline-flex items-center gap-1.5 px-1 py-2 text-xs font-semibold text-teal-600 hover:text-teal-500">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            ເພີ່ມແຖວ
          </button>
        </div>

        {/* footer: remark + totals */}
        <div className="grid gap-6 border-t border-slate-100 px-5 py-4 dark:border-slate-800 md:grid-cols-2">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-400">ໝາຍເຫດ / ເງື່ອນໄຂ</label>
            <textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={4} placeholder="ເງື່ອນໄຂການສັ່ງຊື້, ອ້າງອີງ INVOICE ຯລฯ" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
          </div>
          <div className="md:pl-8">
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-500"><dt>ຍອດກ່ອນ VAT</dt><dd className="tabular-nums">{money(totals.before)}</dd></div>
              <div className="flex justify-between text-slate-500"><dt>VAT ({vatOpt.rate}%)</dt><dd className="tabular-nums">{money(totals.tax)}</dd></div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900 dark:border-slate-700 dark:text-white">
                <dt>ລວມທັງໝົດ</dt><dd className="tabular-nums">{money(totals.total)}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* attachments — attach plan/documents at create time */}
        <div className="border-t border-slate-100 px-5 py-4 dark:border-slate-800">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">ແນບແຜນ / ເອກະສານ</p>
          <p className="mt-0.5 text-[11px] text-slate-400">ແນບຕັ້ງແຕ່ຕອນສ້າງ ເພື່ອໃຫ້ຜູ້ອະນຸມັດກວດເບິ່ງ (ຫຼາຍໄຟລ໌ໄດ້, ≤20MB)</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select name="kind" className={`${U} w-28`}>
              <option value="plan">ແຜນ</option>
              <option value="document">ເອກະສານ</option>
            </select>
            <input name="files" type="file" multiple className="block text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200 dark:text-slate-300 dark:file:bg-slate-800 dark:file:text-slate-200" />
          </div>
        </div>
      </div>
    </form>
  );
}

function Row({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-center gap-3">
      <label className="text-xs text-slate-500 dark:text-slate-400">
        {label}{required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
