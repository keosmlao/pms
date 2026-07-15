import { redirect } from "next/navigation";
import { getIsAdmin } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";
import SpareImportForm from "./SpareImportForm";

export default async function SpareImportPage() {
  const user = await getCurrentUser();
  if (!user || !(await getIsAdmin(user.employeeCode))) redirect("/products");

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <span>ໜ້າຫຼັກ</span><span>/</span><span className="text-slate-600">ນຳເຂົ້າອາໄຫຼ່</span>
      </div>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
        ນຳເຂົ້າ / ຜູກອາໄຫຼ່ເປັນຊຸດ
      </h1>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        ວາງລາຍການອາໄຫຼ່ພ້ອມລຸ້ນທີ່ໃຊ້ໄດ້ ຈາກ Excel ແລ້ວລະບົບຈະຜູກກັບສິນຄ້າໃຫ້ອັດຕະໂນມັດ
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <SpareImportForm />
        </div>
        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold text-slate-900 dark:text-white">ຮູບແບບຂໍ້ມູນ</p>
          <p className="mt-2 text-[11px] leading-5 text-slate-500 dark:text-slate-400">ກວດລະຫັດອາໄຫຼ່, ລຸ້ນທີ່ຮອງຮັບ ແລະຈຳນວນໃຫ້ຄົບກ່ອນນຳເຂົ້າ.</p>
        </aside>
      </div>
    </div>
  );
}
