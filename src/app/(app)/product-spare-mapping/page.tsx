import MappingImportForm from "./MappingImportForm";

export default function ProductSpareMappingPage() {
  return (
    <div className="w-full">
      <div className="text-[11px] text-slate-400">
        ໜ້າຫຼັກ <span className="px-1">/</span> ສິນຄ້າ <span className="px-1">/</span>
        <span className="text-slate-600"> ຈັດການສິນຄ້າ–ອາໄຫຼ່</span>
      </div>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">ຈັດການຄູ່ສິນຄ້າ–ອາໄຫຼ່</h1>
          <p className="mt-1 text-xs text-slate-500">ນຳເຂົ້າຫຼາຍສິນຄ້າຫຼັກ ແລະຫຼາຍອາໄຫຼ່ໃນຄັ້ງດຽວ</p>
        </div>
        <div className="rounded-xl border border-teal-100 bg-teal-50 px-4 py-2 text-xs text-teal-800">
          1 ແຖວ = 1 ສິນຄ້າຫຼັກ + 1 ອາໄຫຼ່
        </div>
      </div>
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <MappingImportForm />
      </section>
    </div>
  );
}
