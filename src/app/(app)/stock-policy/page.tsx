import Link from "next/link";
import { redirect } from "next/navigation";
import { BU_LABELS, listPolicies } from "@/lib/stock-policy";
import { getIsAdmin } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";
import { addPolicy, deletePolicy, updatePolicy } from "./actions";

const inputCls =
  "h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 outline-none focus:border-teal-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

function fmt(v: string | number | null) {
  if (v == null) return "-";
  const n = Number(v);
  return Number.isNaN(n) ? String(v) : n.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

export default async function StockPolicyPage({
  searchParams,
}: {
  searchParams: Promise<{ bu?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const isAdmin = await getIsAdmin(user.employeeCode);

  const buParam = (await searchParams).bu ?? "11";
  const bu = BU_LABELS[buParam] ? buParam : "11";
  const rows = await listPolicies(bu);
  const brandRows = rows.filter((r) => r.supplier_name === "");
  const detailRows = rows.filter((r) => r.supplier_name !== "");
  const overCount = brandRows.filter(
    (r) => r.dii_actual != null && Number(r.dii_actual) > Number(r.sale_months) + Number(r.stock_months),
  ).length;

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 text-[11px] text-slate-400"><span>ໜ້າຫຼັກ</span><span>/</span><span className="text-slate-600">ນະໂຍບາຍ Stock</span></div>
      <div className="mt-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">ນະໂຍບາຍ Stock (DII Target)</h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          DII ເປົ້າ = ຂາຍ 1 ເດືອນ + stock N ເດືອນ · DII ຕົວຈິງ = stock ຄົງເຫຼືອ ÷ ຍອດຂາຍສະເລ່ຍ/ເດືອນ (ຈາກ ERP)
          {overCount > 0 && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/40 dark:text-red-300">ເກີນນະໂຍບາຍ {overCount} ຍີ່ຫໍ້</span>}
        </p>
      </div>

      <div className="mt-5 inline-flex flex-wrap rounded-lg border border-slate-200 bg-white p-0.5 text-xs dark:border-slate-700 dark:bg-slate-900">
        {Object.entries(BU_LABELS).map(([code, label]) => (
          <Link key={code} href={`/stock-policy?bu=${code}`} className={`rounded-md px-3 py-1.5 font-semibold ${bu === code ? "bg-teal-600 text-white" : "text-slate-600 dark:text-slate-300"}`}>{label}</Link>
        ))}
      </div>

      {isAdmin && (
        <form action={addPolicy} className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <input type="hidden" name="group_main" value={bu} />
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">ເພີ່ມ/ທັບຍີ່ຫໍ້</span>
          <input name="brand" placeholder="ຊື່ຍີ່ຫໍ້ (ຕາມ ERP)" className={inputCls} />
          <input type="number" name="stock_months" defaultValue={2} min={0} max={24} step="0.5" title="stock ເດືອນ" className={`${inputCls} w-20`} />
          <button type="submit" className="rounded-lg bg-teal-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-teal-500">ບັນທຶກ</button>
        </form>
      )}

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[10px] uppercase text-slate-500 dark:border-slate-800">
                <th className="px-4 py-2.5 font-semibold">ຍີ່ຫໍ້</th>
                <th className="px-3 py-2.5 text-right font-semibold" title="ສັດສ່ວນຍອດຂາຍໃນ BU (ຈາກໄຟລ໌ນະໂຍບາຍ)">% ຂາຍ</th>
                <th className="px-3 py-2.5 text-right font-semibold">Stock ຄົງເຫຼືອ</th>
                <th className="px-3 py-2.5 text-right font-semibold">ຂາຍ/ເດືອນ</th>
                <th className="px-3 py-2.5 text-right font-semibold">DII ຕົວຈິງ</th>
                <th className="px-3 py-2.5 text-right font-semibold">DII ເປົ້າ</th>
                <th className="px-3 py-2.5 font-semibold">ສະຖານະ</th>
                {isAdmin && <th className="px-3 py-2.5 font-semibold">stock ເດືອນ / ເຫດຜົນ</th>}
                {isAdmin && <th className="px-2 py-2.5"></th>}
              </tr>
            </thead>
            <tbody>
              {brandRows.map((r) => {
                const target = Number(r.sale_months) + Number(r.stock_months);
                const actual = r.dii_actual == null ? null : Number(r.dii_actual);
                const over = actual != null && actual > target;
                return (
                  <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-2 font-semibold text-slate-800 dark:text-slate-100">{r.brand}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{r.sale_share ? (Number(r.sale_share) * 100).toFixed(1) + "%" : "-"}</td>
                    <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-200">{fmt(r.stock_qty)}</td>
                    <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">{fmt(r.sale_per_month)}</td>
                    <td className={`px-3 py-2 text-right font-bold ${over ? "text-red-600" : actual == null ? "text-slate-400" : "text-emerald-600"}`}>{actual == null ? "-" : fmt(actual)}</td>
                    <td className="px-3 py-2 text-right font-bold text-slate-800 dark:text-slate-100">{fmt(target)}</td>
                    <td className="px-3 py-2">
                      {actual == null ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800">ບໍ່ມີຍອດຂາຍ</span>
                      ) : over ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/40 dark:text-red-300">ເກີນ +{fmt(actual - target)} ເດືອນ</span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">ຕາມນະໂຍບາຍ</span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="px-3 py-1.5">
                        <form action={updatePolicy} className="flex items-center gap-1.5">
                          <input type="hidden" name="id" value={r.id} />
                          <input type="number" name="stock_months" defaultValue={Number(r.stock_months)} min={0} max={24} step="0.5" className={`${inputCls} w-16`} />
                          <input name="reason" defaultValue={r.reason} placeholder="ເຫດຜົນ" className={`${inputCls} w-44`} />
                          <button type="submit" className="rounded-md bg-slate-800 px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-slate-700 dark:bg-slate-700">ບັນທຶກ</button>
                        </form>
                      </td>
                    )}
                    {isAdmin && (
                      <td className="px-2 py-1.5">
                        <form action={deletePolicy}>
                          <input type="hidden" name="id" value={r.id} />
                          <button type="submit" title="ລຶບ" className="text-slate-300 hover:text-red-500">✕</button>
                        </form>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {detailRows.length > 0 && (
        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-3 dark:border-slate-800 dark:bg-slate-950/40">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">ລາຍລະອຽດລະດັບຜູ້ສະໜອງ ({detailRows.length})</h2>
            <p className="text-[10px] text-slate-500">ຈາກໄຟລ໌ Policy Stock PIPE — ເຫດຜົນທີ່ຖື stock ຫຼາຍກວ່າມາດຕະຖານ (MOQ / ໂປຣໂມຊັນ)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[10px] uppercase text-slate-500 dark:border-slate-800">
                  <th className="px-4 py-2.5 font-semibold">ຍີ່ຫໍ້</th>
                  <th className="px-3 py-2.5 font-semibold">ຜູ້ສະໜອງ</th>
                  <th className="px-3 py-2.5 text-right font-semibold">DII ເປົ້າ (ເດືອນ)</th>
                  <th className="px-3 py-2.5 font-semibold">ເຫດຜົນ</th>
                </tr>
              </thead>
              <tbody>
                {detailRows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                    <td className="px-4 py-2 font-semibold text-slate-700 dark:text-slate-200">{r.brand}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300"><span className="block max-w-xs truncate" title={r.supplier_name}>{r.supplier_name}</span></td>
                    <td className="px-3 py-2 text-right font-bold text-slate-800 dark:text-slate-100">{fmt(Number(r.sale_months) + Number(r.stock_months))}</td>
                    <td className="px-3 py-2 text-slate-500"><span className="block max-w-md truncate" title={r.reason}>{r.reason || "-"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
