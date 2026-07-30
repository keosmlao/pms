import Link from "next/link";
import { redirect } from "next/navigation";
import { listCatalogs } from "@/lib/catalog";
import { getCurrentUser } from "@/lib/session";
import CreateCatalogForm from "./CreateCatalogForm";

function fmtDate(v: string) {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

export default async function CatalogListPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const catalogs = await listCatalogs();

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 text-[11px] text-slate-400"><span>ໜ້າຫຼັກ</span><span>/</span><span className="text-slate-600">ແຄັດຕາລ໊ອກ</span></div>
      <div className="mt-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">ແຄັດຕາລ໊ອກ / ໂບຊົວ</h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">ສ້າງແຄັດຕາລ໊ອກສິນຄ້າ PDF (ຮູບ + ລາຄາ) ໃຫ້ພະນັກງານຂາຍໄປສະເໜີລູກຄ້າ</p>
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">ສ້າງໃໝ່</h2>
        <CreateCatalogForm />
      </div>

      {catalogs.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400 dark:border-slate-700">ຍັງບໍ່ມີແຄັດຕາລ໊ອກ</p>
      ) : (
        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full min-w-[640px] text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[10px] uppercase text-slate-500 dark:border-slate-800">
                <th className="px-4 py-2.5 font-semibold">ຊື່</th>
                <th className="px-4 py-2.5 text-right font-semibold">ສິນຄ້າ</th>
                <th className="px-4 py-2.5 font-semibold">ຜູ້ສ້າງ</th>
                <th className="px-4 py-2.5 font-semibold">ວັນທີ</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {catalogs.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-2.5"><Link href={`/catalog/${c.id}`} className="font-semibold text-blue-700 hover:underline dark:text-blue-400">{c.title}</Link></td>
                  <td className="px-4 py-2.5 text-right text-slate-500">{c.item_count}</td>
                  <td className="px-4 py-2.5 text-slate-500">{c.created_by}</td>
                  <td className="px-4 py-2.5 text-slate-500">{fmtDate(c.created_at)}</td>
                  <td className="px-4 py-2.5 text-right"><a href={`/catalog-print/${c.id}`} target="_blank" className="rounded-md border border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-600 hover:border-teal-300 hover:text-teal-700 dark:border-slate-700 dark:text-slate-300">🖨 PDF</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
