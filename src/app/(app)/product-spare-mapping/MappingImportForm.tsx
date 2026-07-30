"use client";

import { ChangeEvent, DragEvent, useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import * as XLSX from "xlsx";
import { importProductSpareMappings, type MappingImportState } from "./actions";

type Pair = { product: string; spare: string };
const initial: MappingImportState = { error: null, added: 0, duplicates: 0, invalid: [] };

function ImportButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || count === 0} className="rounded-xl bg-teal-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50">
      {pending ? "ກຳລັງກວດ ແລະ ບັນທຶກ..." : `ນຳເຂົ້າ ${count.toLocaleString("en-US")} ຄູ່`}
    </button>
  );
}

export default function MappingImportForm() {
  const [state, action] = useActionState(importProductSpareMappings, initial);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const mergePairs = (newPairs: Pair[]) => {
    setPairs((current) => [...new Map(
      [...current, ...newPairs]
        .filter((pair) => pair.product || pair.spare)
        .map((pair) => [`${pair.product}\u0000${pair.spare}`, pair]),
    ).values()].slice(0, 5000));
  };

  const readFile = async (file?: File) => {
    if (!file) return;
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
    mergePairs(rows.slice(1).map((row) => ({
      product: String(row[0] ?? "").trim(),
      spare: String(row[1] ?? "").trim(),
    })));
  };

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    void readFile(event.target.files?.[0]);
    event.target.value = "";
  };
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    void readFile(event.dataTransfer.files?.[0]);
  };
  const addPasted = (text: string) => {
    mergePairs(text.split(/\r?\n/).map((line) => {
      const [product = "", spare = ""] = line.split(/\t|,|;/);
      return { product: product.trim(), spare: spare.trim() };
    }));
  };
  const downloadTemplate = () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["ລະຫັດສິນຄ້າຫຼັກ", "ລະຫັດອາໄຫຼ່"],
      ["PRODUCT-001", "140101-0001"],
      ["PRODUCT-001", "140101-0002"],
      ["PRODUCT-002", "140101-0001"],
    ]);
    sheet["!cols"] = [{ wch: 24 }, { wch: 24 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Product-Spare");
    XLSX.writeFile(workbook, "product-spare-mapping-template.xlsx");
  };
  const productCount = new Set(pairs.map((pair) => pair.product).filter(Boolean)).size;
  const spareCount = new Set(pairs.map((pair) => pair.spare).filter(Boolean)).size;

  return (
    <form action={action}>
      <input type="hidden" name="mappings" value={JSON.stringify(pairs)} />
      <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`rounded-2xl border-2 border-dashed p-8 text-center transition ${dragging ? "border-teal-500 bg-teal-50" : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/50"}`}
          >
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-teal-100 text-2xl text-teal-700">⇧</div>
            <p className="mt-4 text-sm font-bold">ລາກ Excel / CSV ມາວາງ</p>
            <p className="mt-1 text-xs text-slate-400">2 ຄໍລຳ: ສິນຄ້າຫຼັກ + ອາໄຫຼ່</p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className="hidden" />
            <button type="button" onClick={() => fileRef.current?.click()} className="mt-4 rounded-lg border border-teal-200 bg-white px-4 py-2 text-xs font-bold text-teal-700 hover:bg-teal-50 dark:bg-slate-900">ເລືອກໄຟລ໌</button>
          </div>
          <button type="button" onClick={downloadTemplate} className="text-xs font-bold text-teal-700 hover:underline dark:text-teal-400">↓ ດາວໂຫຼດ Excel Template</button>
          <div>
            <label htmlFor="mapping-paste" className="text-xs font-bold">ຫຼື Copy 2 ຄໍລຳຈາກ Excel</label>
            <textarea
              id="mapping-paste"
              rows={7}
              placeholder={"PRODUCT-001\t140101-0001\nPRODUCT-001\t140101-0002\nPRODUCT-002\t140101-0001"}
              onBlur={(event) => { addPasted(event.target.value); event.target.value = ""; }}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-xs outline-none focus:border-teal-400 dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-950/50">
            <div>
              <p className="text-sm font-bold">ກວດລາຍການກ່ອນນຳເຂົ້າ</p>
              <p className="mt-1 text-[11px] text-slate-400">{productCount} ສິນຄ້າຫຼັກ · {spareCount} ອາໄຫຼ່ · {pairs.length} ຄູ່</p>
            </div>
            {pairs.length > 0 && <button type="button" onClick={() => setPairs([])} className="text-xs font-bold text-red-500">ລຶບທັງໝົດ</button>}
          </div>
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full min-w-[620px]">
              <thead className="sticky top-0 bg-white shadow-sm dark:bg-slate-900">
                <tr className="text-left text-slate-500">
                  <th className="w-14 px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">ສິນຄ້າຫຼັກ</th>
                  <th className="px-4 py-3 font-medium">ອາໄຫຼ່ທີ່ໃຊ້</th>
                  <th className="w-14 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {pairs.length === 0 ? (
                  <tr><td colSpan={4} className="h-72 text-center text-xs text-slate-400">ອັບໂຫຼດໄຟລ໌ ຫຼື ວາງຂໍ້ມູນເພື່ອເບິ່ງ Preview</td></tr>
                ) : pairs.map((pair, index) => (
                  <tr key={`${pair.product}-${pair.spare}`} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                    <td className="px-4 py-3 text-slate-400">{index + 1}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-slate-800 dark:text-slate-100">{pair.product || <span className="text-red-500">ຂໍ້ມູນວ່າງ</span>}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-teal-700 dark:text-teal-400">{pair.spare || <span className="text-red-500">ຂໍ້ມູນວ່າງ</span>}</td>
                    <td className="px-4 py-3"><button type="button" onClick={() => setPairs((items) => items.filter((_, i) => i !== index))} className="text-lg text-slate-300 hover:text-red-500">×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {(state.error || state.added > 0 || state.duplicates > 0 || state.invalid.length > 0) && (
        <div className={`mt-5 rounded-xl border p-4 text-sm ${state.error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {state.error ? <p className="font-bold">{state.error}</p> : <p className="font-bold">ນຳເຂົ້າສຳເລັດ {state.added} ຄູ່ · ມີແລ້ວ {state.duplicates} ຄູ່ · ຂ້າມ {state.invalid.length} ແຖວ</p>}
          {state.invalid.length > 0 && (
            <div className="mt-2 max-h-28 overflow-auto text-xs text-amber-700">
              {state.invalid.slice(0, 20).map((item) => <p key={`${item.row}-${item.product}-${item.spare}`}>ແຖວ {item.row}: {item.product || "-"} → {item.spare || "-"} · {item.reason}</p>)}
            </div>
          )}
        </div>
      )}

      <div className="mt-5 flex justify-end border-t border-slate-200 pt-5 dark:border-slate-800">
        <ImportButton count={pairs.length} />
      </div>
    </form>
  );
}
