import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPr, PR_STATUS } from "@/lib/purchase-requisition";
import { getIsAdmin } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";
import { approvePrAction, rejectPrAction, submitPrAction } from "../actions";

export const dynamic = "force-dynamic";

function fmtDate(d: string | null) {
  if (!d) return "-";
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : d;
}
function money(v: string) {
  const n = Number(v);
  return Number.isNaN(n) ? "-" : n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export default async function PrDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; submitted?: string; approved?: string; rejected?: string; err?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const prId = Number(id);
  if (!Number.isFinite(prId)) notFound();
  const [pr, isAdmin, sp] = await Promise.all([getPr(prId), getIsAdmin(user.employeeCode), searchParams]);
  if (!pr) notFound();

  const st = PR_STATUS[pr.status] ?? PR_STATUS.draft;
  const isOwner = pr.requester_code === user.employeeCode;
  const estTotal = pr.lines.reduce((s, l) => s + Number(l.qty) * Number(l.est_price), 0);
  const stageIdx = pr.status === "draft" ? 0 : pr.status === "pending" ? 1 : 2;

  const flash =
    sp.created ? { tone: "ok", msg: "ສ້າງ PR ແລ້ວ" } :
    sp.submitted ? { tone: "ok", msg: "ສົ່ງຂໍອະນຸມັດແລ້ວ" } :
    sp.approved ? { tone: "ok", msg: "ອະນຸມັດ PR ແລ້ວ — ພ້ອມສ້າງ PO" } :
    sp.rejected ? { tone: "warn", msg: "ໄດ້ປະຕິເສດ PR ນີ້" } :
    sp.err ? { tone: "err", msg: sp.err } : null;

  return (
    <div className="w-full pb-10">
      <div className="flex items-center gap-2 text-[11px] text-slate-400"><Link href="/purchase-requisition" className="hover:underline">ໃບຂໍຊື້</Link><span>/</span><span className="text-slate-600">{pr.pr_no}</span></div>

      {flash && (
        <div className={`mt-3 rounded-md border px-4 py-2.5 text-xs ${
          flash.tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400" :
          flash.tone === "warn" ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400" :
          "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"}`}>{flash.msg}</div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-mono text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{pr.pr_no}</h1>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${st.cls}`}>● {st.label}</span>
          {pr.po_no && <Link href={`/purchase-order/${encodeURIComponent(pr.po_no)}`} className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700 hover:underline dark:bg-sky-500/10 dark:text-sky-400">→ {pr.po_no}</Link>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pr.status === "draft" && isOwner && (
            <form action={submitPrAction}><input type="hidden" name="id" value={pr.id} />
              <button className="rounded-md bg-teal-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-teal-500">ຂໍອະນຸມັດ</button>
            </form>
          )}
          {pr.status === "pending" && isAdmin && (
            <>
              <form action={approvePrAction}><input type="hidden" name="id" value={pr.id} />
                <button className="rounded-md border border-emerald-300 px-4 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-500/40 dark:text-emerald-400 dark:hover:bg-emerald-500/10">✓ ອະນຸມັດ</button>
              </form>
              <form action={rejectPrAction} className="flex items-center gap-1"><input type="hidden" name="id" value={pr.id} />
                <input name="reason" placeholder="ເຫດຜົນ" className="h-8 w-28 rounded-md border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                <button className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10">ປະຕິເສດ</button>
              </form>
            </>
          )}
          {pr.status === "approved" && (
            <Link href={`/purchase-order/new?pr=${pr.id}`} className="rounded-md bg-teal-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-teal-500">ສ້າງ PO ຈາກ PR ນີ້ →</Link>
          )}
        </div>
      </div>

      {/* statusbar */}
      <div className="mt-3 flex overflow-hidden rounded-md border border-slate-300 text-[11px] font-semibold dark:border-slate-700 w-max">
        {["ຮ່າງ", "ລໍຖ້າອະນຸມັດ", "ອະນຸມັດ"].map((s, i) => (
          <span key={s} className={`px-3 py-1.5 ${i <= stageIdx && pr.status !== "rejected" ? "bg-teal-600 text-white" : "bg-white text-slate-400 dark:bg-slate-900"}`}>{s}</span>
        ))}
      </div>

      {pr.status === "rejected" && pr.reject_reason && (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">ເຫດຜົນປະຕິເສດ: {pr.reject_reason}</p>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.7fr_1.3fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">ຂໍ້ມູນ</h2>
          <dl className="mt-2 space-y-2 text-xs">
            <div className="flex justify-between"><dt className="text-slate-500">ວັນທີ</dt><dd className="font-medium text-slate-800 dark:text-slate-200">{fmtDate(pr.doc_date)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">ພະແນກ</dt><dd className="font-medium text-slate-800 dark:text-slate-200">{pr.department_name || "-"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">ຜູ້ຮ້ອງຂໍ</dt><dd className="font-medium text-slate-800 dark:text-slate-200">{pr.requester_name}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">ວັນທີຕ້ອງການ</dt><dd className="font-medium text-slate-800 dark:text-slate-200">{fmtDate(pr.need_date)}</dd></div>
            {pr.approved_by_name && <div className="flex justify-between"><dt className="text-slate-500">ຜູ້ອະນຸມັດ</dt><dd className="font-medium text-slate-800 dark:text-slate-200">{pr.approved_by_name}</dd></div>}
            {pr.note && <div className="border-t border-slate-100 pt-2 dark:border-slate-800"><dt className="text-slate-500">ໝາຍເຫດ</dt><dd className="mt-1 text-slate-700 dark:text-slate-300">{pr.note}</dd></div>}
          </dl>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800"><h2 className="text-sm font-bold text-slate-900 dark:text-white">ລາຍການ · {pr.lines.length}</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-xs">
              <thead><tr className="border-b border-slate-100 bg-slate-50/70 text-left text-[10px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950/40"><th className="px-4 py-2 font-semibold">#</th><th className="px-4 py-2 font-semibold">ສິນຄ້າ</th><th className="px-4 py-2 font-semibold">ໜ່ວຍ</th><th className="px-4 py-2 text-right font-semibold">ຈຳນວນ</th><th className="px-4 py-2 text-right font-semibold">ລາຄາປະມານ</th><th className="px-4 py-2 text-right font-semibold">ລວມ</th></tr></thead>
              <tbody>
                {pr.lines.map((l) => (
                  <tr key={l.line_no} className="border-b border-slate-50 last:border-0 dark:border-slate-800/60">
                    <td className="px-4 py-2 text-slate-400">{l.line_no}</td>
                    <td className="px-4 py-2 text-slate-800 dark:text-slate-200">{l.item_code ? <Link href={`/products/${encodeURIComponent(l.item_code)}`} className="font-mono text-[11px] font-semibold text-blue-700 hover:underline dark:text-blue-400">{l.item_code}</Link> : <span className="text-[10px] text-amber-600">ໃໝ່</span>}<span className="ml-1.5">{l.item_name}</span></td>
                    <td className="px-4 py-2 text-slate-500">{l.unit || "-"}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-700 dark:text-slate-200">{money(l.qty)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-500">{money(l.est_price)}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium text-slate-800 dark:text-slate-100">{money(String(Number(l.qty) * Number(l.est_price)))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t border-slate-200 dark:border-slate-700"><td colSpan={5} className="px-4 py-2 text-right font-bold text-slate-600 dark:text-slate-300">ລວມປະມານ</td><td className="px-4 py-2 text-right font-bold tabular-nums text-slate-900 dark:text-white">{money(String(estTotal))}</td></tr></tfoot>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
