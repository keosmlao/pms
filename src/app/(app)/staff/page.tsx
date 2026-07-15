import { redirect } from "next/navigation";
import { getGroupOptions, getIsAdmin, getStaffWithGroups } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";
import StaffGroupManager from "./StaffGroupManager";

export default async function StaffPage() {
  const user = await getCurrentUser();
  if (!user || !(await getIsAdmin(user.employeeCode))) redirect("/products");

  const [staff, groupOptions] = await Promise.all([
    getStaffWithGroups(),
    getGroupOptions(),
  ]);

  const assigned = staff.reduce((s, e) => s + e.groups.length, 0);

  return (
    <div className="w-full">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span>ໜ້າຫຼັກ</span><span>/</span><span className="text-slate-600">ຈັດການພະນັກງານ</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            ຈັດການພະນັກງານ
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            ກຳນົດພະນັກງານພະແນກພະລິດຕະພັນ ຮັບຜິດຊອບກຸ່ມສິນຄ້າ (ກຸ່ມຫຼັກ / ກຸ່ມຍ່ອຍ)
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">ພະນັກງານ</p>
            <p className="text-lg font-bold text-slate-950 dark:text-white">{staff.length}</p>
          </div>
          <span className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">ກຸ່ມທີ່ກຳນົດ</p>
            <p className="text-lg font-bold text-slate-950 dark:text-white">{assigned}</p>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <StaffGroupManager staff={staff} groupOptions={groupOptions} />
      </div>
    </div>
  );
}
