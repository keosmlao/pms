import { redirect } from "next/navigation";
import { getStaffPerformance } from "@/lib/analytics";
import { getIsAdmin } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";

function fmt(v: string | number) {
  const n = Number(v);
  return Number.isNaN(n) ? String(v) : n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export default async function KpiPage() {
  const user = await getCurrentUser();
  if (!user || !(await getIsAdmin(user.employeeCode))) redirect("/products");
  const staff = await getStaffPerformance();

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 text-[11px] text-slate-400"><span>ໜ້າຫຼັກ</span><span>/</span><span className="text-slate-600">ຜົນງານທີມ</span></div>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">ຜົນງານ ຕໍ່ຜູ້ຮັບຜິດຊອບ</h1>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">ຍອດຂາຍ 90 ວັນ, ມູນຄ່າ stock ແລະ ສິນຄ້າຄ້າງດົນ ຕໍ່ພະນັກງານພະແນກພະລິດຕະພັນ</p>

      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {staff.length === 0 ? <p className="px-5 py-10 text-center text-sm text-slate-400">ຍັງບໍ່ໄດ້ກຳນົດຜູ້ຮັບຜິດຊອບ</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr className="border-b border-slate-200 bg-slate-50/70 text-left text-[10px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950/40">
                <th className="px-4 py-2.5 font-semibold">ພະນັກງານ</th>
                <th className="px-4 py-2.5 text-right font-semibold">ກຸ່ມ</th>
                <th className="px-4 py-2.5 text-right font-semibold">ລາຍການ (stock)</th>
                <th className="px-4 py-2.5 text-right font-semibold">ຂາຍ 90 ວັນ</th>
                <th className="px-4 py-2.5 text-right font-semibold">ມູນຄ່າ stock</th>
                <th className="px-4 py-2.5 text-right font-semibold">ຄ້າງດົນ</th>
              </tr></thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.employee_code} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                    <td className="px-4 py-2.5"><p className="font-semibold text-slate-800 dark:text-white">{s.fullname}</p><p className="text-[10px] text-slate-400">{s.dept_name}</p></td>
                    <td className="px-4 py-2.5 text-right text-slate-500">{s.groups}</td>
                    <td className="px-4 py-2.5 text-right text-slate-700 dark:text-slate-200">{fmt(s.in_stock_items)}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">{fmt(s.sales_90)}</td>
                    <td className="px-4 py-2.5 text-right text-teal-600 dark:text-teal-400">{fmt(s.stock_value)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-red-600 dark:text-red-400">{fmt(s.dead_items)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="mt-3 text-[11px] text-slate-400">ໝາຍເຫດ: ຍັງບໍ່ມີການຕັ້ງ “ເປົ້າຂາຍ” (ຕາຕະລາງ odg_product_sale_target ວ່າງ) — ຖ້າຕ້ອງການ target vs actual ຕ້ອງເພີ່ມ UI ຕັ້ງເປົ້າກ່ອນ.</p>
    </div>
  );
}
