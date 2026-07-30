import Link from "next/link";
import { redirect } from "next/navigation";
import { getPolicyBrands, getSuggestions } from "@/lib/purchase-suggest";
import { BU_LABELS } from "@/lib/stock-policy";
import { getIsAdmin } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";

function fmt(v: string | number | null) {
  if (v == null) return "-";
  const n = Number(v);
  return Number.isNaN(n) ? String(v) : n.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

export default async function SuggestPage({
  searchParams,
}: {
  searchParams: Promise<{ bu?: string; brand?: string; q?: string; group?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await getIsAdmin(user.employeeCode); // everyone can view

  const sp = await searchParams;
  const bu = BU_LABELS[sp.bu ?? ""] ? sp.bu! : "11";
  const brand = sp.brand ?? "";
  const q = sp.q ?? "";
  const groupBySupplier = sp.group === "supplier";
  const exportHref = `/api/purchase-suggest/export?bu=${bu}${brand ? `&brand=${encodeURIComponent(brand)}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  const [{ rows, summary }, brands] = await Promise.all([
    getSuggestions(bu, { brand, q }),
    getPolicyBrands(bu),
  ]);

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <span>ໜ້າຫຼັກ</span><span>/</span>
        <Link href="/purchase-plan" className="hover:text-teal-600">ແຜນການສັ່ງຊື້</Link><span>/</span>
        <span className="text-slate-600">ຄຳແນະນຳຊື້</span>
      </div>
      <div className="mt-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">ຄຳແນະນຳຊື້ (ທັງ Catalog)</h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          ແນະນຳຊື້ = (ຍອດຂາຍ/ເດືອນ × DII ນະໂຍບາຍ) − Stock − ເຄື່ອງກຳລັງມາ · ສະເພາະສິນຄ້າທີ່ມີນະໂຍບາຍ ແລະ ມີຍອດຂາຍ
        </p>
      </div>

      {/* BU tabs */}
      <div className="mt-5 inline-flex flex-wrap rounded-lg border border-slate-200 bg-white p-0.5 text-xs dark:border-slate-700 dark:bg-slate-900">
        {Object.entries(BU_LABELS).map(([code, label]) => (
          <Link key={code} href={`/purchase-plan/suggest?bu=${code}`} className={`rounded-md px-3 py-1.5 font-semibold ${bu === code ? "bg-teal-600 text-white" : "text-slate-600 dark:text-slate-300"}`}>{label}</Link>
        ))}
      </div>

      {/* Filters */}
      <form className="mt-4 flex flex-wrap items-center gap-2" action="/purchase-plan/suggest">
        <input type="hidden" name="bu" value={bu} />
        <input name="q" defaultValue={q} placeholder="ຄົ້ນຫາ ລະຫັດ/ຊື່ສິນຄ້າ" className="h-9 w-56 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-teal-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
        <select name="brand" defaultValue={brand} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900 outline-none focus:border-teal-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
          <option value="">ທຸກຍີ່ຫໍ້</option>
          {brands.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <button type="submit" className="h-9 rounded-lg bg-teal-600 px-4 text-xs font-bold text-white hover:bg-teal-500">ກັ່ນຕອງ</button>
        {(q || brand) && <Link href={`/purchase-plan/suggest?bu=${bu}`} className="text-xs text-slate-500 hover:text-teal-600">ລ້າງ</Link>}
        <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
        <Link href={`/purchase-plan/suggest?bu=${bu}${brand ? `&brand=${encodeURIComponent(brand)}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}${groupBySupplier ? "" : "&group=supplier"}`} className={`h-9 rounded-lg border px-3 py-2 text-xs font-semibold ${groupBySupplier ? "border-teal-400 bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-300" : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"}`}>
          {groupBySupplier ? "✓ ຈັດກຸ່ມຕາມຜູ້ສະໜອງ" : "ຈັດກຸ່ມຕາມຜູ້ສະໜອງ"}
        </Link>
        <a href={exportHref} className="h-9 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-teal-300 hover:text-teal-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">⬇ ດາວໂຫຼດ CSV</a>
      </form>

      {/* Summary */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">ຕ້ອງຊື້ (ລາຍການ)</p>
          <p className="mt-1 text-xl font-bold text-teal-600 dark:text-teal-400">{fmt(summary.need_buy)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">ລວມຈຳນວນແນະນຳຊື້</p>
          <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{fmt(summary.total_qty)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">ສະແດງ (ຮຽງຫຼາຍ→ໜ້ອຍ)</p>
          <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{fmt(summary.shown)}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400 dark:border-slate-700">ບໍ່ມີສິນຄ້າທີ່ຕ້ອງຊື້ຕາມເງື່ອນໄຂນີ້</p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[10px] uppercase text-slate-500 dark:border-slate-800">
                  <th className="px-4 py-2.5 font-semibold">ລະຫັດ / ຊື່</th>
                  <th className="px-3 py-2.5 font-semibold">ຍີ່ຫໍ້</th>
                  {!groupBySupplier && <th className="px-3 py-2.5 font-semibold">ຜູ້ສະໜອງ</th>}
                  <th className="px-3 py-2.5 text-right font-semibold">Stock</th>
                  <th className="px-3 py-2.5 text-right font-semibold">ກຳລັງມາ</th>
                  <th className="px-3 py-2.5 text-right font-semibold">ຂາຍ/ເດືອນ</th>
                  <th className="px-3 py-2.5 text-right font-semibold" title="ເດືອນທີ່ຄຸ້ມ = (Stock + ກຳລັງມາ) ÷ ຂາຍ/ເດືອນ">ຄຸ້ມ (ດ)</th>
                  <th className="px-3 py-2.5 text-right font-semibold">DII ເປົ້າ</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-teal-700 dark:text-teal-300">ແນະນຳຊື້</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const renderRow = (r: (typeof rows)[number]) => {
                    const cover = r.dii_actual == null ? null : Number(r.dii_actual);
                    const target = Number(r.dii_target);
                    return (
                      <tr key={r.code} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-2">
                          <Link href={`/products/${encodeURIComponent(r.code)}`} className="font-mono text-[11px] font-semibold text-blue-700 hover:underline dark:text-blue-400">{r.code}</Link>
                          <span className="block max-w-xs truncate text-[11px] text-slate-600 dark:text-slate-300" title={r.name}>{r.name}</span>
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{r.brand}</td>
                        {!groupBySupplier && <td className="px-3 py-2 text-slate-500"><span className="block max-w-[160px] truncate" title={r.supplier_name}>{r.supplier_name || "-"}</span></td>}
                        <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-200">{fmt(r.stock)}</td>
                        <td className="px-3 py-2 text-right text-slate-500">{fmt(r.incoming)}</td>
                        <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">{fmt(r.sale_month)}</td>
                        <td className={`px-3 py-2 text-right font-semibold ${cover != null && cover < 1 ? "text-red-600" : cover != null && cover < target ? "text-amber-600" : "text-slate-500"}`}>{cover == null ? "-" : fmt(cover)}</td>
                        <td className="px-3 py-2 text-right text-slate-500">{fmt(target)}</td>
                        <td className="px-3 py-2 text-right text-base font-bold text-teal-600 dark:text-teal-400">{fmt(r.recommend_buy)}</td>
                      </tr>
                    );
                  };
                  if (!groupBySupplier) return rows.map(renderRow);
                  const groups: { key: string; name: string; rows: typeof rows }[] = [];
                  for (const r of rows) {
                    const key = r.supplier_code || "—";
                    let g = groups.find((x) => x.key === key);
                    if (!g) { g = { key, name: r.supplier_name || "ບໍ່ກຳນົດຜູ້ສະໜອງ", rows: [] }; groups.push(g); }
                    g.rows.push(r);
                  }
                  groups.sort((a, b) => b.rows.reduce((s, r) => s + Number(r.recommend_buy), 0) - a.rows.reduce((s, r) => s + Number(r.recommend_buy), 0));
                  return groups.flatMap((g) => [
                    <tr key={`h-${g.key}`} className="bg-slate-100/70 dark:bg-slate-800/60">
                      <td colSpan={8} className="px-4 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                        {g.name} <span className="font-mono text-[9px] font-normal text-slate-400">{g.key !== "—" ? g.key : ""}</span>
                        <span className="ml-2 font-normal text-slate-500">· {g.rows.length} ລາຍການ · ລວມແນະນຳຊື້ {fmt(g.rows.reduce((s, r) => s + Number(r.recommend_buy), 0))}</span>
                      </td>
                    </tr>,
                    ...g.rows.map(renderRow),
                  ]);
                })()}
              </tbody>
            </table>
          </div>
          {summary.need_buy > summary.shown && (
            <p className="border-t border-slate-100 px-4 py-2 text-[10px] text-slate-400 dark:border-slate-800">ສະແດງ {summary.shown} ອັນດັບທຳອິດ ຈາກທັງໝົດ {fmt(summary.need_buy)} ລາຍການ — ໃຊ້ຕົວກັ່ນຕອງເພື່ອລະບຸໃຫ້ແຄບລົງ</p>
          )}
        </div>
      )}
    </div>
  );
}
