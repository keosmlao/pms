import Link from "next/link";
import { redirect } from "next/navigation";
import { getPoRemainAging, listPoRemain } from "@/lib/purchase-order";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

function fmt(v: string | number) {
  const n = Number(v);
  return Number.isNaN(n) ? String(v) : n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
function fmtDate(v: string | null) {
  if (!v) return "-";
  return new Date(v).toLocaleDateString("en-GB");
}
function ageTone(days: number) {
  if (days <= 30) return "text-emerald-600 dark:text-emerald-400";
  if (days <= 90) return "text-teal-600 dark:text-teal-400";
  if (days <= 180) return "text-amber-600 dark:text-amber-400";
  if (days <= 360) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

export default async function PendingReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; bucket?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const q = sp.q ?? "";
  const bucket = sp.bucket ?? "";

  const [aging, rows] = await Promise.all([
    getPoRemainAging(q),
    listPoRemain({ q, bucket, limit: 300 }),
  ]);

  const buckets = [
    { key: "b0_30", label: "0–30 ວັນ", value: aging.b0_30, tone: "bg-emerald-500" },
    { key: "b31_90", label: "31–90", value: aging.b31_90, tone: "bg-teal-500" },
    { key: "b91_180", label: "91–180", value: aging.b91_180, tone: "bg-amber-500" },
    { key: "b181_360", label: "181–360", value: aging.b181_360, tone: "bg-orange-500" },
    { key: "b360p", label: "> 360", value: aging.b360p, tone: "bg-red-500" },
  ];
  const maxB = Math.max(1, ...buckets.map((b) => b.value));
  const mkHref = (patch: Record<string, string>) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (bucket) p.set("bucket", bucket);
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    return `/purchase-order/pending-receipt${p.toString() ? `?${p}` : ""}`;
  };

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <span>ໜ້າຫຼັກ</span><span>/</span><span>ຈັດຊື້</span><span>/</span>
        <Link href="/purchase-order" className="hover:text-slate-600">ໃບສັ່ງຊື້</Link>
        <span>/</span><span className="text-slate-600">ຄ້າງຮັບເຂົ້າ</span>
      </div>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">PO ຄ້າງຮັບເຂົ້າ</h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">ສິນຄ້າສັ່ງແລ້ວ ຍັງບໍ່ຮັບເຂົ້າສາງ · ຈັດຕາມໄລຍະເວລາ (aging)</p>
        </div>
        {/* segmented nav */}
        <div className="flex overflow-hidden rounded-lg border border-slate-200 text-xs font-medium dark:border-slate-800">
          <Link href="/purchase-order" className="bg-white px-3.5 py-1.5 text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400">ໃບສັ່ງຊື້</Link>
          <span className="bg-teal-600 px-3.5 py-1.5 text-white">ຄ້າງຮັບເຂົ້າ</span>
        </div>
      </div>

      {/* summary tiles */}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><p className="text-xs text-slate-500">ໃບ PO ຄ້າງ</p><p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{fmt(aging.total_docs)}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><p className="text-xs text-slate-500">ລາຍການຄ້າງ</p><p className="mt-2 text-2xl font-bold text-teal-600 dark:text-teal-400">{fmt(aging.total_lines)}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><p className="text-xs text-slate-500">ຈຳນວນຄ້າງ (ໜ່ວຍ)</p><p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{fmt(aging.total_qty)}</p></div>
      </div>

      {/* aging distribution — clickable */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">ການແຈກຢາຍໄລຍະເວລາຄ້າງ</h2>
          {bucket && <Link href={mkHref({ bucket: "" })} className="text-xs text-teal-600 hover:underline">ລ້າງໂຕກອງ</Link>}
        </div>
        <div className="mt-4 space-y-2">
          {buckets.map((b) => {
            const active = bucket === b.key;
            return (
              <Link key={b.key} href={mkHref({ bucket: active ? "" : b.key })} className={`flex items-center gap-3 rounded-lg px-1 py-0.5 transition hover:bg-slate-50 dark:hover:bg-slate-800/60 ${active ? "ring-1 ring-teal-400" : ""}`}>
                <span className="w-20 shrink-0 text-xs text-slate-500">{b.label}</span>
                <div className="h-5 flex-1 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
                  <div className={`h-full ${b.tone}`} style={{ width: `${(b.value / maxB) * 100}%` }} />
                </div>
                <span className="w-16 shrink-0 text-right text-xs font-semibold text-slate-700 dark:text-slate-200">{fmt(b.value)}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* search */}
      <form className="mt-4 max-w-xs" action="/purchase-order/pending-receipt">
        {bucket && <input type="hidden" name="bucket" value={bucket} />}
        <input name="q" defaultValue={q} placeholder="ຄົ້ນຫາ PO / ຜູ້ສະໜອງ / ສິນຄ້າ..." className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-teal-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
      </form>

      {/* table */}
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">ລາຍການຄ້າງຮັບເຂົ້າ · {rows.length}</h2>
        </div>
        {rows.length === 0 ? (
          <p className="px-5 py-14 text-center text-sm text-slate-400">ບໍ່ມີ PO ຄ້າງຮັບເຂົ້າ 🎉</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-[10px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950/40">
                  <th className="px-4 py-2.5 font-semibold">ເລກ PO</th>
                  <th className="px-4 py-2.5 font-semibold">ວັນທີ</th>
                  <th className="px-4 py-2.5 font-semibold">ຜູ້ສະໜອງ</th>
                  <th className="px-4 py-2.5 font-semibold">ສິນຄ້າ</th>
                  <th className="px-4 py-2.5 text-right font-semibold">ສັ່ງ</th>
                  <th className="px-4 py-2.5 text-right font-semibold">ຄ້າງ</th>
                  <th className="px-4 py-2.5 font-semibold">ຄັງ</th>
                  <th className="px-4 py-2.5 text-right font-semibold">ອາຍຸ (ວັນ)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.doc_no}-${r.item_code}-${i}`} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-2 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">{r.doc_no}</td>
                    <td className="px-4 py-2 text-xs text-slate-500">{fmtDate(r.doc_date)}</td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-200"><span className="block max-w-[180px] truncate">{r.supplier_name}</span></td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-200"><span className="block max-w-xs truncate">{r.item_name}</span><span className="font-mono text-[10px] text-slate-400">{r.item_code}</span></td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-500">{fmt(r.qty)} <span className="text-[10px] text-slate-400">{r.unit}</span></td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums text-slate-900 dark:text-white">{fmt(r.qty_balance)}</td>
                    <td className="px-4 py-2 text-xs text-slate-500"><span className="block max-w-[140px] truncate">{r.warehouse}</span></td>
                    <td className={`px-4 py-2 text-right font-bold tabular-nums ${ageTone(r.aging_days)}`}>{r.aging_days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
