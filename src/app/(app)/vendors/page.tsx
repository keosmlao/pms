import Link from "next/link";
import Pagination from "@/components/Pagination";
import { listVendors } from "@/lib/vendors";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function fmtMoney(v: string) {
  const n = Number(v);
  return Number.isNaN(n) ? "-" : n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export default async function VendorsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const q = sp.q ?? "";
  const PAGE_SIZE = 50;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const fetched = await listVendors({ q, limit: PAGE_SIZE + 1, offset: (page - 1) * PAGE_SIZE });
  const hasNext = fetched.length > PAGE_SIZE;
  const rows = fetched.slice(0, PAGE_SIZE);
  const pageHref = (pg: number) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (pg > 1) p.set("page", String(pg));
    return `/vendors${p.toString() ? `?${p}` : ""}`;
  };

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 text-[11px] text-slate-400"><span>ໜ້າຫຼັກ</span><span>/</span><span>ຈັດຊື້</span><span>/</span><span className="text-slate-600">ຜູ້ສະໜອງ</span></div>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">ຜູ້ສະໜອງ (Vendors)</h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">ຂໍ້ມູນຜູ້ສະໜອງ · ໜີ້ຄ້າງຈ່າຍ · ປະຫວັດຊື້</p>
        </div>
        <form className="sm:w-72" action="/vendors">
          <input
            name="q"
            defaultValue={q}
            placeholder="ຄົ້ນຫາ ລະຫັດ / ຊື່ / ໂທ..."
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-teal-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </form>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[720px] text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-[10px] uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950/40">
              <th className="px-4 py-2.5 font-semibold">ລະຫັດ</th>
              <th className="px-4 py-2.5 font-semibold">ຊື່ຜູ້ສະໜອງ</th>
              <th className="px-4 py-2.5 font-semibold">ແຂວງ</th>
              <th className="px-4 py-2.5 font-semibold">ໂທ</th>
              <th className="px-4 py-2.5 text-right font-semibold">ຄ້າງຈ່າຍ</th>
              <th className="px-4 py-2.5 text-center font-semibold">ເກີນກຳນົດ</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">ບໍ່ພົບຜູ້ສະໜອງ</td></tr>
            )}
            {rows.map((v) => {
              const out = Number(v.ap_outstanding) || 0;
              return (
                <tr key={v.code} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-2 font-mono text-xs">
                    <Link href={`/vendors/${encodeURIComponent(v.code)}`} className="font-semibold text-blue-700 hover:underline dark:text-blue-400">{v.code}</Link>
                  </td>
                  <td className="px-4 py-2 text-slate-800 dark:text-slate-200"><span className="block max-w-md truncate" title={v.name}>{v.name.trim() || "-"}</span>{v.name_eng && <span className="block max-w-md truncate text-[10px] text-slate-400">{v.name_eng}</span>}</td>
                  <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{v.province || "-"}</td>
                  <td className="px-4 py-2 font-mono text-[11px] text-slate-500">{v.tel || "-"}</td>
                  <td className={`px-4 py-2 text-right tabular-nums font-semibold ${out > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-400"}`}>{out > 0 ? fmtMoney(v.ap_outstanding) : "-"}</td>
                  <td className="px-4 py-2 text-center">{v.overdue > 0 ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-950 dark:text-red-300">{v.overdue} ໃບ</span> : <span className="text-slate-300 dark:text-slate-600">-</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination current={page} hasNext={hasNext} hrefFor={pageHref} />
    </div>
  );
}
