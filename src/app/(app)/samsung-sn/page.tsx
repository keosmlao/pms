import Link from "next/link";
import Pagination from "@/components/Pagination";
import { getSamsungSerials, getSamsungSnSummary, type SamsungSnFilter } from "@/lib/samsung-sn";
import { getIsAdmin } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";
import ClaimProcess from "./ClaimProcess";

function fmtDate(value: string | null) {
  if (!value) return "-";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
}

export default async function SamsungSnPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const valid: SamsungSnFilter[] = ["all", "claimed", "unclaimed", "claimed_sold", "sold_unclaimed", "claimed_stock"];
  const status = valid.includes(params.status as SamsungSnFilter) ? params.status as SamsungSnFilter : "all";
  const PAGE_SIZE = 50;
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const user = await getCurrentUser();
  const [summary, serialsFetched, isAdmin] = await Promise.all([
    getSamsungSnSummary(),
    getSamsungSerials(query, status, PAGE_SIZE + 1, (page - 1) * PAGE_SIZE),
    user ? getIsAdmin(user.employeeCode) : Promise.resolve(false),
  ]);
  const hasNext = serialsFetched.length > PAGE_SIZE;
  const serials = serialsFetched.slice(0, PAGE_SIZE);
  const pageHref = (pg: number) => {
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (status !== "all") p.set("status", status);
    if (pg > 1) p.set("page", String(pg));
    return `/samsung-sn${p.toString() ? `?${p}` : ""}`;
  };

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 text-[11px] text-slate-400"><span>ໜ້າຫຼັກ</span><span>/</span><span className="text-slate-600">ບໍລິຫານ SN SAMSUNG</span></div>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">ສະຖານະເຄມ SN SAMSUNG</h1>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">ກວດວ່າ SN ໃດເຄມແລ້ວ, ຍັງບໍ່ເຄມ, ຂາຍແລ້ວ ຫຼືເຄມກ່ອນຂາຍ</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <Summary href="all" active={status === "all"} label="SN ທັງໝົດ" value={summary.total} tone="text-slate-950 dark:text-white" />
        <Summary href="claimed" active={status === "claimed"} label="ເຄມແລ້ວ" value={summary.claimed} tone="text-teal-600" />
        <Summary href="unclaimed" active={status === "unclaimed"} label="ຍັງບໍ່ເຄມ" value={summary.unclaimed} tone="text-amber-600" />
        <Summary href="claimed_sold" active={status === "claimed_sold"} label="ເຄມແລ້ວ · ຂາຍແລ້ວ" value={summary.claimed_sold} tone="text-blue-600" />
        <Summary href="sold_unclaimed" active={status === "sold_unclaimed"} label="ຂາຍແລ້ວ · ຍັງບໍ່ເຄມ" value={summary.sold_unclaimed} tone="text-orange-600" />
        <Summary href="claimed_stock" active={status === "claimed_stock"} label="ເຄມກ່ອນຂາຍ · ຍັງຢູ່ສາງ" value={summary.claimed_in_stock} tone="text-red-600" />
      </div>

      {summary.claimed_unmatched > 0 && <p className="mt-2 text-[10px] text-slate-400">ມີ {summary.claimed_unmatched.toLocaleString("en-US")} SN ທີ່ເຄມແລ້ວ ແຕ່ບໍ່ພົບ SN ກົງກັນໃນສາງ.</p>}

      <form className="mt-4 flex flex-col gap-3 rounded-xl glass p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row" method="GET">
        <input type="hidden" name="status" value={status} />
        <input name="q" defaultValue={query} placeholder="ຄົ້ນຫາ SN, ລະຫັດ, ຊື່, Model, ໃບຂາຍ ຫຼືໝາຍເຫດເຄມ..." className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-teal-400 focus:bg-white dark:border-slate-700 dark:bg-slate-950" />
        <button className="min-h-10 rounded-lg bg-teal-600 px-5 text-xs font-bold text-white hover:bg-teal-500" type="submit">ຄົ້ນຫາ</button>
        <Link href="/samsung-sn" className="grid min-h-10 place-items-center rounded-lg border border-slate-200 px-4 text-xs font-semibold text-slate-500 hover:bg-slate-50 dark:border-slate-700">ລ້າງ</Link>
      </form>

      <div className="mt-4 overflow-hidden rounded-xl glass shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800"><h2 className="text-sm font-bold text-slate-900 dark:text-white">ລາຍການ SN</h2><span className="text-[11px] text-slate-400">ສະແດງ {serials.length} ລາຍການ</span></div>
        {serials.length === 0 ? <p className="px-5 py-12 text-center text-xs text-slate-400">ບໍ່ພົບລາຍການ</p> : <div className="overflow-x-auto"><table className="w-full min-w-[1340px] text-xs">
          <thead><tr className="border-b border-slate-200 bg-slate-50/70 text-left text-[10px] text-slate-500 dark:border-slate-800 dark:bg-slate-950/40"><th className="px-4 py-2.5 font-semibold">SN</th><th className="px-4 py-2.5 font-semibold">ສິນຄ້າ / MODEL</th><th className="px-4 py-2.5 font-semibold">ເຄມ</th><th className="px-4 py-2.5 font-semibold">ຂາຍ / ສາງ</th><th className="px-4 py-2.5 font-semibold">ສາງ</th><th className="px-4 py-2.5 font-semibold">RACK / LOCATION</th><th className="px-4 py-2.5 font-semibold">ວັນທີ / ໃບຂາຍ</th>{isAdmin && <th className="px-4 py-2.5 font-semibold">PROCESS</th>}</tr></thead>
          <tbody>{serials.map((row, index) => <tr key={`${row.serial_no}-${index}`} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
            <td className="px-4 py-2 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">{row.serial_no}</td>
            <td className="px-4 py-2">{row.item_code ? <Link href={`/products/${encodeURIComponent(row.item_code)}`} className="font-semibold text-blue-700 hover:underline dark:text-blue-400">{row.item_code}</Link> : <span className="text-slate-400">-</span>}<p className="mt-0.5 max-w-md truncate text-xs text-slate-700 dark:text-slate-200">{row.item_name || "-"}</p><p className="text-[10px] text-slate-400">{row.model || "-"}</p></td>
            <td className="px-4 py-2">{row.is_claimed ? <><span className="rounded-full bg-teal-50 px-2 py-1 text-[10px] font-bold text-teal-700 dark:bg-teal-950">ເຄມແລ້ວ</span><p className="mt-1 max-w-44 truncate text-[10px] text-slate-500" title={row.claim_note}>{row.claim_note}</p></> : <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700 dark:bg-amber-950">ຍັງບໍ່ເຄມ</span>}</td>
            <td className="px-4 py-2">{row.stock_status === 1 ? <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 dark:bg-blue-950">ຂາຍແລ້ວ</span> : row.stock_status === 0 ? <><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${row.is_claimed ? "bg-red-50 text-red-700 dark:bg-red-950" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950"}`}>{row.is_claimed ? "ເຄມກ່ອນຂາຍ" : "ຍັງຢູ່ສາງ"}</span></> : <span className="text-[10px] text-slate-400">ບໍ່ພົບໃນສາງ</span>}</td>
            <td className="px-4 py-2 text-xs text-slate-600 dark:text-slate-300">{row.wh_name || row.wh_code || "-"}</td>
            <td className="px-4 py-2 text-xs text-slate-600 dark:text-slate-300"><p>{row.rack_name || row.rack || "-"}</p><p className="text-[10px] text-slate-400">{row.location_name || row.location || "-"}</p></td>
            <td className="px-4 py-2 text-xs text-slate-500"><p>{fmtDate(row.record_date)}</p><p className="font-mono text-[10px] text-slate-400">{row.bill_no || "-"}</p></td>
            {isAdmin && <td className="px-4 py-2">{row.is_claimed ? <span className="text-[10px] font-semibold text-emerald-600">✓ ສຳເລັດແລ້ວ</span> : <ClaimProcess serialNo={row.serial_no} />}</td>}
          </tr>)}</tbody>
        </table></div>}
      </div>
      <Pagination current={page} hasNext={hasNext} hrefFor={pageHref} />
    </div>
  );
}

function Summary({ label, value, tone, href, active }: { label: string; value: number; tone: string; href: SamsungSnFilter; active: boolean }) {
  return <Link href={`/samsung-sn?status=${href}`} className={`rounded-xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 dark:bg-slate-900 ${active ? "border-teal-500 ring-2 ring-teal-500/15" : "border-slate-200 dark:border-slate-800"}`}><p className="text-xs font-medium text-slate-500">{label}</p><p className={`mt-2 text-2xl font-bold ${tone}`}>{value.toLocaleString("en-US")}</p><p className="mt-2 text-[10px] font-semibold text-teal-600">ເບິ່ງລາຍການ →</p></Link>;
}
