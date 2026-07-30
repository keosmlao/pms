import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getVendor } from "@/lib/vendors";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

function fmtMoney(v: string | null) {
  if (v == null) return "-";
  const n = Number(v);
  return Number.isNaN(n) ? "-" : n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
function fmtDate(v: string | null) {
  if (!v) return "-";
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : v;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-2 text-xl font-bold tracking-tight ${tone ?? "text-slate-900 dark:text-white"}`}>{value}</p>
    </div>
  );
}
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 last:border-0 dark:border-slate-800">
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-right text-xs font-medium text-slate-800 dark:text-slate-200">{value || "-"}</dd>
    </div>
  );
}

export default async function VendorDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { code } = await params;
  const decoded = decodeURIComponent(code);
  const data = await getVendor(decoded);
  if (!data) notFound();
  const { vendor: v, stats, payables, pos } = data;
  const location = [v.tambon, v.amper, v.province].filter(Boolean).join(", ");

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 text-[11px] text-slate-400"><Link href="/vendors" className="hover:underline">ຜູ້ສະໜອງ</Link><span>/</span><span className="text-slate-600">{decoded}</span></div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{v.name.trim() || decoded}</h1>
        <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">{decoded}</span>
      </div>
      {v.name_eng && <p className="mt-1 text-xs text-slate-500">{v.name_eng}</p>}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="ຄ້າງຈ່າຍ" value={fmtMoney(stats.ap_outstanding)} tone={Number(stats.ap_outstanding) > 0 ? "text-amber-600 dark:text-amber-400" : undefined} />
        <Stat label="ເກີນກຳນົດ" value={fmtMoney(stats.ap_overdue)} tone={Number(stats.ap_overdue) > 0 ? "text-red-600 dark:text-red-400" : undefined} />
        <Stat label="ຈຳນວນ PO" value={stats.po_count.toLocaleString("en-US")} />
        <Stat label="ຊື້ຫຼ້າສຸດ" value={fmtDate(stats.last_po_date)} />
      </div>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">ຂໍ້ມູນຕິດຕໍ່</h2>
          <dl className="mt-2">
            <Field label="ໂທລະສັບ" value={v.tel} />
            <Field label="Fax" value={v.fax} />
            <Field label="Email" value={v.email} />
            <Field label="Website" value={v.website} />
            <Field label="ທີ່ຢູ່" value={v.address} />
            <Field label="ເມືອງ/ແຂວງ" value={location} />
            <Field label="ປະເພດ" value={v.ap_type} />
            {v.remark && <Field label="ໝາຍເຫດ" value={v.remark} />}
          </dl>
        </section>

        <div className="flex flex-col gap-4">
          {/* Outstanding payables */}
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800"><h2 className="text-sm font-bold text-slate-900 dark:text-white">ໜີ້ຄ້າງຈ່າຍ · {payables.length}</h2></div>
            {payables.length === 0 ? <p className="px-5 py-8 text-center text-xs text-slate-400">ບໍ່ມີໜີ້ຄ້າງ 👍</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-xs">
                  <thead><tr className="border-b border-slate-100 bg-slate-50/70 text-left text-[10px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950/40"><th className="px-4 py-2 font-semibold">ເອກະສານ</th><th className="px-4 py-2 font-semibold">ຄົບກຳນົດ</th><th className="px-4 py-2 text-right font-semibold">ຍອດ</th><th className="px-4 py-2 text-right font-semibold">ຄ້າງ</th><th className="px-4 py-2 text-center font-semibold">ເກີນ(ວັນ)</th></tr></thead>
                  <tbody>
                    {payables.map((b, i) => (
                      <tr key={`${b.doc_no}-${i}`} className="border-b border-slate-50 last:border-0 dark:border-slate-800/60">
                        <td className="px-4 py-2"><span className="font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-200">{b.doc_no || "-"}</span><span className="block text-[10px] text-slate-400">{b.doc_type_name}</span></td>
                        <td className="px-4 py-2 text-slate-500">{fmtDate(b.due_date)}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-slate-500">{fmtMoney(b.amount)}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-semibold text-amber-600 dark:text-amber-400">{fmtMoney(b.balance)}</td>
                        <td className="px-4 py-2 text-center">{b.overdue_day > 0 ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-950 dark:text-red-300">{b.overdue_day}</span> : <span className="text-emerald-600">✓</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Recent POs */}
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800"><h2 className="text-sm font-bold text-slate-900 dark:text-white">PO ຫຼ້າສຸດ · {pos.length}</h2></div>
            {pos.length === 0 ? <p className="px-5 py-8 text-center text-xs text-slate-400">ຍັງບໍ່ມີ PO</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-xs">
                  <thead><tr className="border-b border-slate-100 bg-slate-50/70 text-left text-[10px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950/40"><th className="px-4 py-2 font-semibold">ເລກ PO</th><th className="px-4 py-2 font-semibold">ວັນທີ</th><th className="px-4 py-2 text-center font-semibold">ລາຍການ</th><th className="px-4 py-2 text-right font-semibold">ມູນຄ່າ</th></tr></thead>
                  <tbody>
                    {pos.map((p) => (
                      <tr key={p.doc_no} className="border-b border-slate-50 last:border-0 dark:border-slate-800/60">
                        <td className="px-4 py-2"><Link href={`/purchase-order/${encodeURIComponent(p.doc_no)}`} className="font-mono font-semibold text-blue-700 hover:underline dark:text-blue-400">{p.doc_no}</Link><span className="ml-1 text-[10px] text-slate-400">{p.format}</span></td>
                        <td className="px-4 py-2 text-slate-500">{fmtDate(p.doc_date)}</td>
                        <td className="px-4 py-2 text-center tabular-nums text-slate-500">{p.lines}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-medium text-slate-800 dark:text-slate-100">{fmtMoney(p.total_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
