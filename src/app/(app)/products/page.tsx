import Link from "next/link";
import { getFilterOptions, getProducts, getUserGroupCount, getUserGroups, type ProductFilters } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";
import FilterSelect from "./FilterSelect";
import ProductGroupFilters from "./ProductGroupFilters";

function fmtNum(value: string | null): string {
  if (value == null) return "-";
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

type SP = {
  q?: string;
  group_main?: string;
  group_sub?: string;
  group_sub2?: string;
  category?: string;
  brand?: string;
  in_stock?: string;
  mine?: string | string[];
  page?: string;
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const myGroupCount = user ? await getUserGroupCount(user.employeeCode) : 0;
  const isOwner = myGroupCount > 0;
  // Owners see their groups by default (ເປັນຫຼັກ). The toggle sends a hidden
  // mine=0 plus mine=1 when checked, so: no param → on; ["0","1"] → on; ["0"] → off.
  const mineValues = Array.isArray(sp.mine) ? sp.mine : sp.mine ? [sp.mine] : [];
  const mineOn = isOwner && (mineValues.length === 0 || mineValues.includes("1"));

  // When the owner's "my groups" view is on and they own exactly one group,
  // lock the group filter to it (pre-selected + read-only).
  const myGroups = mineOn && user ? await getUserGroups(user.employeeCode) : [];
  const lockGroup = mineOn && myGroups.length === 1;
  const myMains = new Set(myGroups.map((g) => g.group_main));

  const filters: ProductFilters = {
    q: sp.q ?? "",
    groupMain: lockGroup ? myGroups[0].group_main : sp.group_main ?? "",
    groupSub: lockGroup ? myGroups[0].group_sub : sp.group_sub ?? "",
    groupSub2: sp.group_sub2 ?? "",
    category: sp.category ?? "",
    brand: sp.brand ?? "",
    inStock: sp.in_stock === "1",
    mineOf: mineOn ? (user?.employeeCode ?? "") : "",
  };
  const page = Number(sp.page ?? "1") || 1;

  const [{ rows, total, page: current, totalPages }, options] = await Promise.all([
    getProducts(filters, page),
    getFilterOptions(),
  ]);
  const activeFilterCount = [
    filters.groupMain,
    filters.groupSub,
    filters.groupSub2,
    filters.category,
    filters.brand,
    filters.inStock ? "1" : "",
  ].filter(Boolean).length;

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.groupMain) params.set("group_main", filters.groupMain);
    if (filters.groupSub) params.set("group_sub", filters.groupSub);
    if (filters.groupSub2) params.set("group_sub2", filters.groupSub2);
    if (filters.category) params.set("category", filters.category);
    if (filters.brand) params.set("brand", filters.brand);
    if (filters.inStock) params.set("in_stock", "1");
    if (isOwner && !mineOn) params.set("mine", "0");
    params.set("page", String(p));
    return `/products?${params.toString()}`;
  };

  const exportHref = (() => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.groupMain) params.set("group_main", filters.groupMain);
    if (filters.groupSub) params.set("group_sub", filters.groupSub);
    if (filters.groupSub2) params.set("group_sub2", filters.groupSub2);
    if (filters.category) params.set("category", filters.category);
    if (filters.brand) params.set("brand", filters.brand);
    if (filters.inStock) params.set("in_stock", "1");
    if (isOwner && !mineOn) params.set("mine", "0");
    const qs = params.toString();
    return `/api/products/export${qs ? `?${qs}` : ""}`;
  })();

  return (
    <div className="w-full">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400"><span>ໜ້າຫຼັກ</span><span>/</span><span className="text-slate-600">ຂໍ້ມູນສິນຄ້າ</span></div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">ຂໍ້ມູນສິນຄ້າ</h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">ຄົ້ນຫາ ແລະ ກວດສອບລາຍການສິນຄ້າທັງໝົດ</p>
        </div>
        <div className="flex w-fit items-center gap-3">
          <a
            href={exportHref}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 shadow-sm transition hover:border-teal-300 hover:text-teal-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            ⬇ Export CSV
          </a>
          <div className="inline-flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-50 text-base text-teal-600 dark:bg-teal-950">□</span>
            <div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">ພົບທັງໝົດ</p><p className="text-lg font-bold text-slate-950 dark:text-white">{total.toLocaleString("en-US")} <span className="text-xs font-normal text-slate-400">ລາຍການ</span></p></div>
          </div>
        </div>
      </div>

      <form
        method="GET"
        className="mt-5 overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-lg text-slate-400" aria-hidden="true">⌕</span>
            <input
              type="search"
              name="q"
              defaultValue={filters.q}
              aria-label="ຄົ້ນຫາສິນຄ້າ"
              placeholder="ຄົ້ນຫາດ້ວຍລະຫັດ ຫຼື ຊື່ສິນຄ້າ..."
              className="min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50/60 py-2 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>
          <button type="submit" className="min-h-10 rounded-lg bg-teal-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-500">
            ຄົ້ນຫາ
          </button>
          <Link href="/products" className="grid min-h-10 place-items-center rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
            ລ້າງ
          </Link>
        </div>
        <details open={activeFilterCount > 0} className="group border-t border-slate-100 dark:border-slate-800">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/50 [&::-webkit-details-marker]:hidden">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-teal-50 text-teal-600 dark:bg-teal-950" aria-hidden="true">≡</span>
            ຕົວກອງລະອຽດ
            {activeFilterCount > 0 && <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-700 dark:bg-teal-950 dark:text-teal-300">{activeFilterCount}</span>}
            <span className="ml-auto text-slate-400 transition group-open:rotate-180" aria-hidden="true">⌄</span>
          </summary>
          <div className="border-t border-slate-100 bg-slate-50/40 p-4 dark:border-slate-800 dark:bg-slate-950/30">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <ProductGroupFilters
                groupMain={filters.groupMain}
                groupSub={filters.groupSub}
                groupSub2={filters.groupSub2}
                mainOptions={
                  isOwner && !lockGroup && myMains.size > 0
                    ? options.groupMain.filter((o) => myMains.has(o.code))
                    : options.groupMain
                }
                subOptions={options.groupSub}
                sub2Options={options.groupSub2}
                locked={lockGroup}
              />
              <FilterSelect name="category" label="ໝວດ" value={filters.category} options={options.category} />
              <FilterSelect name="brand" label="ແບນ" value={filters.brand} options={options.brand} />
            </div>
            <div className="mt-3 flex flex-wrap gap-4">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                <input type="checkbox" name="in_stock" value="1" defaultChecked={filters.inStock} className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-400 dark:border-slate-600" />
                ສະແດງສະເພາະສິນຄ້າທີ່ມີ stock
              </label>
              {isOwner && (
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                  {/* unchecked sends mine=0 to turn the default-on view off */}
                  <input type="hidden" name="mine" value="0" />
                  <input type="checkbox" name="mine" value="1" defaultChecked={mineOn} className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-400 dark:border-slate-600" />
                  ສະເພາະກຸ່ມທີ່ຂ້ອຍຮັບຜິດຊອບ
                </label>
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button type="submit" className="rounded-lg bg-slate-900 px-5 py-2 text-xs font-bold text-white transition hover:bg-slate-700 dark:bg-teal-600 dark:hover:bg-teal-500">ນຳໃຊ້ຕົວກອງ</button>
            </div>
          </div>
        </details>
      </form>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[960px] table-fixed text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-[10px] uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
              <th className="w-36 px-4 py-2.5 font-semibold">ລະຫັດ</th>
              <th className="w-[36%] px-4 py-2.5 font-semibold">ຊື່ສິນຄ້າ</th>
              <th className="w-32 px-4 py-2.5 font-semibold">ໝວດ</th>
              <th className="w-32 px-4 py-2.5 font-semibold">ຍີ່ຫໍ້</th>
              <th className="w-24 px-4 py-2.5 text-right font-semibold">ຄົງເຫຼືອ</th>
              <th className="w-24 px-4 py-2.5 font-semibold">ໜ່ວຍ</th>
              <th className="w-36 px-4 py-2.5 text-right font-semibold">ຕົ້ນທຶນສະເລ່ຍ</th>
              <th className="w-40 px-4 py-2.5 font-semibold">ຜູ້ຮັບຜິດຊອບ</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                  ບໍ່ພົບຂໍ້ມູນສິນຄ້າ
                </td>
              </tr>
            )}
            {rows.map((p) => (
              <tr
                key={p.code}
                className="group border-b border-slate-100 last:border-0 hover:bg-teal-50/40 dark:border-slate-800 dark:hover:bg-slate-800/50"
              >
                <td className="border-l-2 border-transparent px-4 py-2 font-mono text-xs group-hover:border-teal-400">
                  <Link
                    href={`/products/${encodeURIComponent(p.code)}`}
                    className="font-semibold text-blue-700 transition hover:underline dark:text-blue-400"
                  >
                    {p.code}
                  </Link>
                </td>
                <td className="px-4 py-2 font-semibold text-slate-800 dark:text-white">
                  <span className="block truncate" title={p.name_1 || p.name_eng_1 || "-"}>
                    {p.name_1 || p.name_eng_1 || "-"}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                  {p.category_name || "-"}
                </td>
                <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                  {p.item_brand || "-"}
                </td>
                <td className="px-4 py-2 text-right">
                  <span
                    className={`inline-flex min-w-8 justify-center rounded-md px-2.5 py-0.5 font-bold ${
                      Number(p.balance_qty) > 0
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                    }`}
                  >
                    {fmtNum(p.balance_qty)}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                  {p.unit_standard_name || "-"}
                </td>
                <td className="px-4 py-2 text-right font-semibold text-slate-800 dark:text-white">
                  {fmtNum(p.average_cost)}
                </td>
                <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                  <span className="block truncate" title={p.responsible_name ?? ""}>
                    {p.responsible_name || "-"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <span className="text-slate-500 dark:text-slate-400">
            ໜ້າ {current} / {totalPages}
          </span>
          <div className="flex gap-2">
            <PageLink disabled={current <= 1} href={pageHref(current - 1)}>
              ກ່ອນໜ້າ
            </PageLink>
            <PageLink disabled={current >= totalPages} href={pageHref(current + 1)}>
              ຖັດໄປ
            </PageLink>
          </div>
        </div>
      )}
    </div>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const base = "rounded-xl border px-4 py-2 font-medium transition";
  if (disabled) {
    return (
      <span
        className={`${base} cursor-not-allowed border-slate-200 text-slate-300 dark:border-slate-800 dark:text-slate-600`}
      >
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={`${base} border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800`}
    >
      {children}
    </Link>
  );
}
