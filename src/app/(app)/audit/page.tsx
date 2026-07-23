import { redirect } from "next/navigation";
import { getRecentActivity } from "@/lib/audit";
import { getIsAdmin } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";

function fmtDateTime(value: string | null): string {
  if (!value) return "-";
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]} ${m[4]}:${m[5]}` : value;
}

export default async function AuditPage() {
  const user = await getCurrentUser();
  if (!user || !(await getIsAdmin(user.employeeCode))) redirect("/products");
  const items = await getRecentActivity(100);

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <span>ໜ້າຫຼັກ</span><span>/</span><span className="text-slate-600">ບັນທຶກກິດຈະກຳ</span>
      </div>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">ບັນທຶກກິດຈະກຳ</h1>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        ການກຳນົດຜູ້ຮັບຜິດຊອບ ແລະ ການຜູກອາໄຫຼ່ · 100 ລາຍການລ້າສຸດ
      </p>

      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {items.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">ຍັງບໍ່ມີກິດຈະກຳ</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-[10px] uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950/40">
                  <th className="px-4 py-2.5 font-semibold">ເວລາ</th>
                  <th className="px-4 py-2.5 font-semibold">ປະເພດ</th>
                  <th className="px-4 py-2.5 font-semibold">ລາຍລະອຽດ</th>
                  <th className="px-4 py-2.5 font-semibold">ໂດຍ</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                    <td className="px-4 py-2.5 whitespace-nowrap font-mono text-xs text-slate-500 dark:text-slate-400">
                      {fmtDateTime(it.at)}
                    </td>
                    <td className="px-4 py-2.5">
                      {it.kind === "group" ? (
                        <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700 dark:bg-teal-950 dark:text-teal-300">ຮັບຜິດຊອບ</span>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">ອາໄຫຼ່</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200">
                      <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{it.target}</span>
                      {it.detail ? <span className="ml-2">· {it.detail}</span> : ""}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                      {it.by_name || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="mt-3 text-[11px] text-slate-400">
        ໝາຍເຫດ: ສະແດງສະຖານະປັດຈຸບັນ (ການລຶບບໍ່ຖືກບັນທຶກ). ຖ້າຕ້ອງການ audit ເຕັມ ຕ້ອງມີຕາຕະລາງ log ແຍກ.
      </p>
    </div>
  );
}
