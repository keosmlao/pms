import Link from "next/link";
import { redirect } from "next/navigation";
import { getIsAdmin } from "@/lib/products";
import { getAttachmentsFor, getPendingLines, listPendingApprovals, PO_CURRENCIES } from "@/lib/purchase-order";
import { getCurrentUser } from "@/lib/session";
import { approveAction, rejectAction } from "../actions";

export const dynamic = "force-dynamic";

const CUR = Object.fromEntries(PO_CURRENCIES.map((c) => [c.code, c.label.split(" ")[0]]));
const money = (n: string) => Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDT = (d: string | null) => (d ? new Date(d).toLocaleString("en-GB") : "-");
const fmtD = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB") : "-");

export default async function ApprovalsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const isAdmin = await getIsAdmin(user.employeeCode);
  if (!isAdmin) redirect("/purchase-order");

  const rows = await listPendingApprovals(200);
  const docNos = rows.map((r) => r.doc_no);
  const [allLines, allAtts] = await Promise.all([getPendingLines(docNos), getAttachmentsFor(docNos)]);
  const linesBy = new Map<string, typeof allLines>();
  for (const l of allLines) (linesBy.get(l.doc_no) ?? linesBy.set(l.doc_no, []).get(l.doc_no)!).push(l);
  const attsBy = new Map<string, typeof allAtts>();
  for (const a of allAtts) (attsBy.get(a.doc_no) ?? attsBy.set(a.doc_no, []).get(a.doc_no)!).push(a);

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <span>ໜ້າຫຼັກ</span><span>/</span>
        <Link href="/purchase-order" className="hover:text-slate-600">ໃບສັ່ງຊື້</Link>
        <span>/</span><span className="text-slate-600">ອະນຸມັດ</span>
      </div>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">ອະນຸມັດ PO</h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">PO ທີ່ລໍຖ້າ Director ອະນຸມັດ · {rows.length} ໃບ</p>
        </div>
        <div className="flex overflow-hidden rounded-lg border border-slate-200 text-xs font-medium dark:border-slate-800">
          <Link href="/purchase-order" className="bg-white px-3.5 py-1.5 text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400">ໃບສັ່ງຊື້</Link>
          <span className="bg-teal-600 px-3.5 py-1.5 text-white">ອະນຸມັດ</span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-400 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          ບໍ່ມີ PO ລໍຖ້າອະນຸມັດ 🎉
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {rows.map((r) => (
            <div key={r.doc_no} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/purchase-order/${encodeURIComponent(r.doc_no)}`} className="font-mono text-base font-bold text-blue-700 hover:underline dark:text-blue-400">{r.doc_no}</Link>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">{r.format}</span>
                    {r.wpoa_no && <span className="font-mono text-[11px] text-slate-400">↳ {r.wpoa_no}</span>}
                  </div>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{r.supplier_name} <span className="font-mono text-[11px] text-slate-400">{r.supplier_code}</span></p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    ສົ່ງໂດຍ {r.submitted_by} · {fmtDT(r.submitted_at)} ·{" "}
                    <Link href={`/purchase-order/${encodeURIComponent(r.doc_no)}`} className="text-teal-600 hover:underline">ໄຟລ໌ແນບ {r.attachments}</Link>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{money(r.total_amount)} <span className="text-xs font-normal text-slate-400">{CUR[r.currency_code] ?? ""}</span></p>
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <details className="relative">
                      <summary className="cursor-pointer list-none rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-500/40 dark:hover:bg-red-500/10">ປະຕິເສດ</summary>
                      <form action={rejectAction} className="absolute right-0 z-10 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                        <input type="hidden" name="doc_no" value={r.doc_no} />
                        <textarea name="reason" rows={2} placeholder="ເຫດຜົນ..." className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                        <button type="submit" className="mt-2 w-full rounded-md bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-500">ຢືนยันປະຕິເສດ</button>
                      </form>
                    </details>
                    <form action={approveAction}>
                      <input type="hidden" name="doc_no" value={r.doc_no} />
                      <button type="submit" className="rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-500">ອະນຸມັດ</button>
                    </form>
                  </div>
                </div>
              </div>

              {/* attachments */}
              {(attsBy.get(r.doc_no)?.length ?? 0) > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400">ໄຟລ໌ແນບ:</span>
                  {attsBy.get(r.doc_no)!.map((a) => (
                    <a key={a.id} href={`/api/po-attachment/${a.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-blue-700 hover:bg-slate-50 dark:border-slate-700 dark:text-blue-400 dark:hover:bg-slate-800">
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                      {a.file_name}
                    </a>
                  ))}
                </div>
              )}

              {/* line details with last purchase price */}
              <div className="mt-3 overflow-x-auto border-t border-slate-100 pt-3 dark:border-slate-800">
                <table className="w-full min-w-[520px] text-xs">
                  <thead>
                    <tr className="text-left text-[10px] uppercase text-slate-400">
                      <th className="py-1 pr-3 font-semibold">ສິນຄ້າ</th>
                      <th className="px-2 py-1 text-right font-semibold">ຈຳນວນ</th>
                      <th className="px-2 py-1 text-right font-semibold">ລາຄາ</th>
                      <th className="px-2 py-1 text-right font-semibold text-amber-700 dark:text-amber-400">ຊື້ຄັ້ງກ່ອນ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(linesBy.get(r.doc_no) ?? []).map((l) => {
                      const lb = Number(l.last_buy_price), pr = Number(l.price), diff = pr - lb;
                      const tone = diff > 0 ? "text-red-600 dark:text-red-400" : diff < 0 ? "text-green-600 dark:text-green-400" : "text-slate-400";
                      return (
                        <tr key={l.line_number} className="border-t border-slate-50 dark:border-slate-800/60">
                          <td className="py-1.5 pr-3 text-slate-700 dark:text-slate-200"><span className="block max-w-md truncate">{l.item_name}</span><span className="font-mono text-[10px] text-slate-400">{l.item_code}</span></td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{money(l.qty)} <span className="text-[10px]">{l.unit}</span></td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{money(l.price)}</td>
                          <td className="px-2 py-1.5 text-right">
                            {lb <= 0 ? <span className="text-slate-300">-</span> : (
                              <>
                                <span className="tabular-nums font-bold text-amber-700 dark:text-amber-400">{money(l.last_buy_price)}</span>
                                {pr > 0 && diff !== 0 && <span className={`ml-1 text-[10px] font-bold ${tone}`}>{diff > 0 ? "▲" : "▼"}</span>}
                                <span className="block text-[9px] text-slate-400">{fmtD(l.last_buy_date)}</span>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
