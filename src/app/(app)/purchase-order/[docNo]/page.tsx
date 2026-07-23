import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getIsAdmin, getProductDeptStaff } from "@/lib/products";
import {
  getPoActivities,
  getPoComments,
  getPoFollowers,
  getPurchaseOrder,
  PO_CURRENCIES,
} from "@/lib/purchase-order";
import { getCurrentUser } from "@/lib/session";
import { approveAction, deleteAttachmentAction, rejectAction, revokeApprovalAction, submitApprovalAction } from "../actions";
import AttachmentUpload from "./AttachmentUpload";
import ElapsedTimer from "./ElapsedTimer";
import PoChatter from "./PoChatter";

export const dynamic = "force-dynamic";

const CUR = Object.fromEntries(PO_CURRENCIES.map((c) => [c.code, c.label]));
const money = (n: string) => Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB") : "-");
const fmtDT = (d: string | null) => (d ? new Date(d).toLocaleString("en-GB") : "-");

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "ຮ່າງ", cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  pending: { label: "ລໍຖ້າອະນຸມັດ", cls: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" },
  approved: { label: "ອະນຸມັດແລ້ວ", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" },
  rejected: { label: "ຖືກປະຕິເສດ", cls: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400" },
};

export default async function PoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ docNo: string }>;
  searchParams: Promise<{ created?: string; approved?: string; rejected?: string; submitted?: string; revoked?: string; err?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { docNo } = await params;
  const sp = await searchParams;
  const detail = await getPurchaseOrder(decodeURIComponent(docNo));
  if (!detail) notFound();

  const [isAdmin, comments, activities, followers, staff] = await Promise.all([
    getIsAdmin(user.employeeCode),
    getPoComments(detail.header.doc_no),
    getPoActivities(detail.header.doc_no),
    getPoFollowers(detail.header.doc_no),
    getProductDeptStaff(),
  ]);
  const isFollowing = followers.some((f) => f.employee_code === user.employeeCode);
  const { header, lines, receipts, payable, approval, attachments } = detail;

  // Live "time used" timer: from PO creation until goods fully received.
  const ordered = lines.reduce((s, l) => s + Number(l.qty), 0);
  const received = lines.reduce((s, l) => s + Number(l.received), 0);
  const isFull = ordered > 0 && received >= ordered;
  const startMs = header.created_at ? new Date(header.created_at).getTime() : null;
  const completedMs =
    isFull && receipts.length > 0
      ? Math.max(...receipts.map((r) => new Date(r.created_at ?? r.doc_date ?? 0).getTime()))
      : null;
  const st = STATUS[approval.status] ?? STATUS.draft;
  const stages = ["draft", "pending", "approved"];
  const stageIdx = approval.status === "rejected" ? 1 : stages.indexOf(approval.status);

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <span>ໜ້າຫຼັກ</span><span>/</span>
        <Link href="/purchase-order" className="hover:text-slate-600">ໃບສັ່ງຊື້</Link>
        <span>/</span><span className="text-slate-600">{header.doc_no}</span>
      </div>

      {/* flash */}
      {sp.created && <Flash tone="ok" msg="ສ້າງ PO ສຳເລັດ (ຮ່າງ) — ແນບແຜນ/ເອກະສານ ແລ້ວກົດ ສົ່ງຂໍອະນຸມັດ" />}
      {sp.approved && <Flash tone="ok" msg="ອະນຸມັດ PO ສຳເລັດ" />}
      {sp.submitted && <Flash tone="ok" msg="ສົ່ງຂໍອະນຸມັດແລ້ວ — ສ້າງເອກະສານ WPOA" />}
      {sp.rejected && <Flash tone="warn" msg="ໄດ້ປະຕິເສດ PO ນີ້" />}
      {sp.revoked && <Flash tone="warn" msg="ຍົກເລີກອະນຸມັດແລ້ວ — PO ກັບເປັນ ລໍຖ້າອະນຸມັດ" />}
      {sp.err && <Flash tone="err" msg={sp.err} />}

      {/* header bar */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-mono text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{header.doc_no}</h1>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">{header.format}</span>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${st.cls}`}>● {st.label}</span>
        </div>
        {/* stages */}
        <div className="flex overflow-hidden rounded-md border border-slate-300 text-[11px] font-semibold dark:border-slate-700">
          {["ຮ່າງ", "ລໍຖ້າອະນຸມັດ", "ອະນຸມັດ"].map((s, i) => (
            <span key={s} className={`px-3 py-1.5 ${i <= stageIdx && approval.status !== "rejected" ? "bg-teal-600 text-white" : "bg-white text-slate-400 dark:bg-slate-900"}`}>{s}</span>
          ))}
        </div>
      </div>

      {startMs && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">⏱ ເວລາທີ່ໃຊ້ (ສ້າງ → ຮັບຄົບ):</span>
          <ElapsedTimer startMs={startMs} endMs={isFull ? (completedMs ?? startMs) : null} />
          {isFull ? (
            <span className="rounded-full bg-green-600 px-2.5 py-1 text-[11px] font-semibold text-white">● ຮັບຄົບແລ້ວ (ຢຸດ)</span>
          ) : (
            <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-700 dark:bg-teal-500/10 dark:text-teal-400">● ກຳລັງດຳເນີນ</span>
          )}
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* left: header + lines */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              <Info label="ຜູ້ສະໜອງ" value={`${header.supplier_name} · ${header.supplier_code}`} />
              <Info label="ວັນທີເອກະສານ" value={fmtDate(header.doc_date)} />
              <Info label="ວັນຄາດຮັບເຄື່ອງ (ETA)" value={fmtDate(header.eta)} />
              <Info label="ເຄຣดิต" value={header.credit_day > 0 ? `${header.credit_day} ວັນ` : "ເງິນສົດ"} />
              <Info label="ສະກຸນເງິນ" value={`${CUR[header.currency_code] ?? header.currency_code} × ${header.exchange_rate}`} />
              <Info label="ສາຂາ" value={header.branch_name ? `${header.branch_code} · ${header.branch_name}` : header.branch_code} />
              <Info label="ໝາຍເຫດ" value={header.remark || "-"} full />
            </div>
          </div>

          {/* Card 1 — ລາຍການສັ່ງຊື້ (order) */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-100 px-4 py-2.5 text-xs font-bold text-slate-900 dark:border-slate-800 dark:text-white">ລາຍການສັ່ງຊື້ · {lines.length}</div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-[10px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950/40">
                    <th className="px-3 py-2 font-semibold">#</th>
                    <th className="px-3 py-2 font-semibold">ສິນຄ້າ</th>
                    <th className="px-3 py-2 font-semibold">ສາງ</th>
                    <th className="px-3 py-2 font-semibold">ອ້າງອີງ PR</th>
                    <th className="px-3 py-2 text-right font-semibold">ຈຳນວນ</th>
                    <th className="px-3 py-2 text-right font-semibold">ລາຄາ</th>
                    <th className="px-3 py-2 text-right font-semibold text-amber-700 dark:text-amber-400">ຊື້ຄັ້ງກ່ອນ</th>
                    <th className="px-3 py-2 text-right font-semibold">ລວມ</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.line_number} className="border-b border-slate-50 last:border-0 dark:border-slate-800/60">
                      <td className="px-3 py-1.5 text-slate-400">{l.line_number + 1}</td>
                      <td className="px-3 py-1.5 text-slate-800 dark:text-slate-200"><span className="block max-w-sm truncate">{l.item_name}</span><span className="font-mono text-[10px] text-slate-400">{l.item_code}</span></td>
                      <td className="px-3 py-1.5 text-slate-500"><span className="block max-w-[150px] truncate">{l.wh_name || l.wh_code || "-"}</span><span className="font-mono text-[10px] text-slate-400">{l.wh_code}</span></td>
                      <td className="px-3 py-1.5">
                        {l.ref_pr ? (
                          <span className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400">{l.ref_pr}</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{money(l.qty)} <span className="text-[10px] text-slate-400">{l.unit}</span></td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{money(l.price)}</td>
                      <td className="px-3 py-1.5 text-right">
                        {(() => {
                          const lb = Number(l.last_buy_price), pr = Number(l.price);
                          if (lb <= 0) return <span className="text-slate-300">-</span>;
                          const diff = pr - lb;
                          const tone = diff > 0 ? "text-red-600 dark:text-red-400" : diff < 0 ? "text-green-600 dark:text-green-400" : "text-slate-400";
                          return (
                            <>
                              <span className="tabular-nums text-sm font-bold text-amber-700 dark:text-amber-400">{money(l.last_buy_price)}</span>
                              {pr > 0 && diff !== 0 && <span className={`ml-1 text-[11px] font-bold ${tone}`}>{diff > 0 ? "▲" : "▼"}</span>}
                              <span className="block text-[10px] text-slate-400">{fmtDate(l.last_buy_date)}</span>
                            </>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-1.5 text-right font-medium tabular-nums text-slate-900 dark:text-white">{money(l.sum_amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 dark:border-slate-700">
                    <td colSpan={7} className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500">ລວມທັງໝົດ</td>
                    <td className="px-3 py-2.5 text-right text-sm font-bold tabular-nums text-slate-900 dark:text-white">{money(header.total_amount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Card 2 — ຮັບເຂົ້າ (GR) */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-100 px-4 py-2.5 text-xs font-bold text-slate-900 dark:border-slate-800 dark:text-white">ຮັບເຂົ້າ (GR) · {receipts.length}</div>
            {receipts.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-slate-400">ຍັງບໍ່ຮັບເຂົ້າ</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-[10px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950/40">
                      <th className="px-3 py-2 font-semibold">PUI</th>
                      <th className="px-3 py-2 font-semibold">ວັນທີ</th>
                      <th className="px-3 py-2 font-semibold">ສິນຄ້າ</th>
                      <th className="px-3 py-2 font-semibold">ສາງທີ່ຮັບ</th>
                      <th className="px-3 py-2 text-right font-semibold">ຈຳນວນຮັບ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipts.map((g, i) => (
                      <tr key={`${g.pui}-${g.ref_line}-${i}`} className="border-b border-slate-50 last:border-0 dark:border-slate-800/60">
                        <td className="px-3 py-1.5 font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-200">{g.pui}</td>
                        <td className="px-3 py-1.5 text-slate-500">{fmtDate(g.doc_date)}</td>
                        <td className="px-3 py-1.5 text-slate-700 dark:text-slate-200"><span className="block max-w-xs truncate">{g.item_name}</span><span className="font-mono text-[10px] text-slate-400">{g.item_code}</span></td>
                        <td className="px-3 py-1.5 text-slate-500"><span className="block max-w-[150px] truncate">{g.wh_name || g.wh_code}</span><span className="font-mono text-[10px] text-slate-400">{g.wh_code}</span></td>
                        <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-green-600 dark:text-green-400">{money(g.qty)} <span className="text-[10px] font-normal text-slate-400">{g.unit}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ໜີ້ & ຊຳລະ (AP) */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">ໜີ້ & ຊຳລະ (AP)</h2>
              {!payable.has_ap ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">ຍັງບໍ່ຕັ້ງໜີ້</span>
              ) : Number(payable.balance) <= 0 ? (
                <span className="rounded-full bg-green-600 px-2.5 py-1 text-[11px] font-semibold text-white">● ຊຳລະແລ້ວ</span>
              ) : (
                <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-400">● ຄ້າງຊຳລະ {payable.overdue_day > 0 ? `· ${payable.overdue_day} ວັນ` : ""}</span>
              )}
            </div>
            {payable.has_ap && (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div><p className="text-[10px] uppercase tracking-widest text-slate-400">ຍອດໜີ້</p><p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-200">{money(payable.amount)}</p></div>
                <div><p className="text-[10px] uppercase tracking-widest text-slate-400">ຄ້າງຊຳລະ</p><p className={`mt-0.5 text-sm font-bold tabular-nums ${Number(payable.balance) > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>{money(payable.balance)}</p></div>
                <div className="col-span-2 sm:col-span-1"><p className="text-[10px] uppercase tracking-widest text-slate-400">ໃບໜີ້</p><p className="mt-0.5 font-mono text-[11px] text-slate-600 dark:text-slate-300">{payable.docs}</p></div>
              </div>
            )}
          </div>

          {/* attachments */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">ແຜນ & ເອກະສານແນບ · {attachments.length}</h2>
            <p className="mt-0.5 text-[11px] text-slate-400">ແນບກ່ອນຂໍອະນຸມັດ ເພື່ອໃຫ້ຜູ້ອະນຸມັດກວດເບິ່ງ</p>
            {approval.status !== "approved" && (
              <div className="mt-3">
                <AttachmentUpload docNo={header.doc_no} />
              </div>
            )}
            <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
              {attachments.length === 0 && <li className="py-4 text-center text-xs text-slate-400">ຍັງບໍ່ມີໄຟລ໌ແນບ</li>}
              {attachments.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2.5">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${a.kind === "plan" ? "bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}>{a.kind === "plan" ? "ແຜນ" : "ເອກະສານ"}</span>
                  <a href={`/api/po-attachment/${a.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm text-blue-700 hover:underline dark:text-blue-400">{a.file_name}</a>
                  <span className="shrink-0 text-[11px] text-slate-400">{a.size_bytes ? `${Math.round(Number(a.size_bytes) / 1024)} KB` : ""}</span>
                  {approval.status !== "approved" && (
                    <form action={deleteAttachmentAction}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="doc_no" value={header.doc_no} />
                      <button type="submit" className="text-slate-300 transition hover:text-red-500" aria-label="ລຶບ">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* right: approval panel */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">ການອະນຸມັດ</h2>

            {approval.wpoa_no && (
              <p className="mt-2 text-xs text-slate-500">ໃບຂໍອະນຸມັດ: <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{approval.wpoa_no}</span></p>
            )}
            {approval.poa_no && (
              <p className="mt-1 text-xs text-slate-500">ໃບອະນຸມັດ (POA): <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">{approval.poa_no}</span></p>
            )}

            {approval.status === "draft" && (
              <form action={submitApprovalAction} className="mt-3">
                <input type="hidden" name="doc_no" value={header.doc_no} />
                <button type="submit" className="w-full rounded-md bg-teal-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-500">ສົ່ງຂໍອະນຸມັດ</button>
                <p className="mt-2 text-[11px] text-slate-400">ຕ້ອງແນບແຜນ/ເອກະສານກ່ອນ</p>
              </form>
            )}

            {approval.status === "rejected" && (
              <div className="mt-3">
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
                  <p className="font-semibold">ຖືກປະຕິເສດ</p>
                  <p className="mt-1">{approval.reject_reason}</p>
                </div>
                <form action={submitApprovalAction} className="mt-3">
                  <input type="hidden" name="doc_no" value={header.doc_no} />
                  <button type="submit" className="w-full rounded-md bg-teal-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-500">ສົ່ງຂໍອະນຸມັດອີກຄັ້ງ</button>
                </form>
              </div>
            )}

            {approval.status === "pending" && (
              <div className="mt-3 space-y-3">
                <p className="text-xs text-slate-500">ສົ່ງໂດຍ {approval.submitted_by} · {fmtDT(approval.submitted_at)}</p>
                {isAdmin ? (
                  <>
                    <form action={approveAction}>
                      <input type="hidden" name="doc_no" value={header.doc_no} />
                      <button type="submit" className="w-full rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-500">ອະນຸມັດ</button>
                    </form>
                    <form action={rejectAction} className="space-y-2">
                      <input type="hidden" name="doc_no" value={header.doc_no} />
                      <textarea name="reason" rows={2} placeholder="ເຫດຜົນປະຕິເສດ..." className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                      <button type="submit" className="w-full rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-500/40 dark:hover:bg-red-500/10">ປະຕິເສດ</button>
                    </form>
                  </>
                ) : (
                  <p className="rounded-md bg-amber-50 px-3 py-2.5 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">ລໍຖ້າ PM Director ອະນຸມັດ</p>
                )}
              </div>
            )}

            {approval.status === "approved" && (
              <div className="mt-3 space-y-3">
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <p className="font-semibold">ອະນຸມັດແລ້ວ</p>
                  <p className="mt-1">ໂດຍ {approval.approved_by} · {fmtDT(approval.approved_at)}</p>
                </div>
                {isAdmin && (
                  <form action={revokeApprovalAction}>
                    <input type="hidden" name="doc_no" value={header.doc_no} />
                    <button type="submit" className="w-full rounded-md border border-red-300 px-4 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-500/40 dark:hover:bg-red-500/10">ຍົກເລີກອະນຸມັດ (ລົບໃບ POA)</button>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Odoo-style chatter: messages, activities, followers */}
          <PoChatter
            docNo={header.doc_no}
            comments={comments}
            activities={activities}
            followers={followers}
            staff={staff}
            currentUserCode={user.employeeCode}
            isFollowing={isFollowing}
          />
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <p className="text-[10px] uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm text-slate-800 dark:text-slate-200">{value}</p>
    </div>
  );
}

function Flash({ tone, msg }: { tone: "ok" | "warn" | "err"; msg: string }) {
  const cls =
    tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400"
        : "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400";
  return <div className={`mt-3 rounded-md border px-4 py-2.5 text-sm ${cls}`}>{msg}</div>;
}
