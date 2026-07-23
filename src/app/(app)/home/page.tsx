import Link from "next/link";
import { getDashboardStock } from "@/lib/dashboard";
import { getUserGroupCount } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";
import WarehouseSelect from "./WarehouseSelect";

export const dynamic = "force-dynamic";

function fmt(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function fmtDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("lo-LA", { day: "2-digit", month: "short" }).format(date);
}

const KPI_STYLE = {
  opening: { icon: "○", iconClass: "bg-blue-50 text-blue-600 dark:bg-blue-950", valueClass: "text-blue-700 dark:text-blue-300" },
  received: { icon: "↓", iconClass: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950", valueClass: "text-emerald-700 dark:text-emerald-300" },
  issued: { icon: "↑", iconClass: "bg-red-50 text-red-600 dark:bg-red-950", valueClass: "text-red-700 dark:text-red-300" },
  closing: { icon: "■", iconClass: "bg-teal-50 text-teal-600 dark:bg-teal-950", valueClass: "text-teal-700 dark:text-teal-300" },
};

function KpiCard({ label, value, note, tone }: { label: string; value: number; note: string; tone: keyof typeof KPI_STYLE }) {
  const style = KPI_STYLE[tone];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className={`mt-2 text-2xl font-bold tracking-tight ${style.valueClass}`}>{fmt(value)}</p>
          <p className="mt-1 text-[10px] text-slate-400">{note}</p>
        </div>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg font-bold ${style.iconClass}`}>{style.icon}</span>
      </div>
    </div>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; wh?: string }>;
}) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const groupCount = user ? await getUserGroupCount(user.employeeCode) : 0;
  const canScope = groupCount > 0;

  // Default to "my responsible products" when the user owns groups; otherwise "all".
  const scope: "mine" | "all" = canScope
    ? sp.scope === "all"
      ? "all"
      : "mine"
    : "all";
  const whList = (sp.wh ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const stock = await getDashboardStock({ employeeCode: user?.employeeCode, scope, warehouses: whList });
  const net = stock.today.received - stock.today.issued;

  const mkScope = (s: "mine" | "all") => {
    const p = new URLSearchParams();
    if (s !== "all") p.set("scope", s);
    if (whList.length) p.set("wh", whList.join(","));
    return `/home${p.toString() ? `?${p}` : ""}`;
  };
  // Build a URL with a given warehouse set (used by the breakdown rows to add/remove).
  const mkWh = (next: string[]) => {
    const p = new URLSearchParams();
    if (scope === "mine") p.set("scope", "mine");
    if (next.length) p.set("wh", next.join(","));
    return `/home${p.toString() ? `?${p}` : ""}`;
  };
  const selectedNames = whList
    .map((c) => stock.warehouses.find((w) => w.code === c)?.code ?? c)
    .join(", ");

  return (
    <div className="w-full">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400"><span>ໜ້າຫຼັກ</span><span>/</span><span className="text-slate-600">ພາບລວມ stock</span></div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">ສະບາຍດີ, {user?.fullname}</h1>
          <p className="mt-1 text-xs text-slate-500">ພາບລວມການເຄື່ອນໄຫວສິນຄ້າປະຈຳວັນ</p>
        </div>
        <Link href="/products" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-teal-500">
          <span className="text-base">＋</span> ເປີດລາຍການສິນຄ້າ
        </Link>
      </div>

      {/* scope + warehouse filters */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {canScope && (
          <div className="flex overflow-hidden rounded-lg border border-slate-200 text-xs font-medium dark:border-slate-800">
            {([
              { key: "mine", label: "ສິນຄ້າຂອງຂ້ອຍ" },
              { key: "all", label: "ທັງໝົດ" },
            ] as const).map((t) => {
              const active = scope === t.key;
              return (
                <Link
                  key={t.key}
                  href={mkScope(t.key)}
                  className={`px-3.5 py-1.5 transition ${
                    active
                      ? "bg-teal-600 text-white"
                      : "bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-slate-400">ສາງ:</span>
          <WarehouseSelect warehouses={stock.warehouses} selected={whList} scope={scope} />
        </div>
        {(whList.length > 0 || scope === "mine") && (
          <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-semibold text-teal-700 dark:bg-teal-950 dark:text-teal-300">
            {scope === "mine" ? "ສະເພາະສິນຄ້າຂອງຂ້ອຍ" : "ທຸກສິນຄ້າ"}
            {whList.length ? ` · ${whList.length} ສາງ (${selectedNames})` : ""}
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="ຍອດຕົ້ນມື້" value={stock.today.opening} note="ຄົງເຫຼືອກ່ອນເລີ່ມລາຍການມື້ນີ້" tone="opening" />
        <KpiCard label="ຮັບເຂົ້າມື້ນີ້" value={stock.today.received} note="ຊື້ເຂົ້າ, ຮັບຄືນ, ໂອນເຂົ້າ" tone="received" />
        <KpiCard label="ຈ່າຍອອກມື້ນີ້" value={stock.today.issued} note="ຂາຍ, ເບີກ, ປັບຫຼຸດ, ໂອນອອກ" tone="issued" />
        <KpiCard label="ຍອດທ້າຍມື້" value={stock.today.closing} note={`${stock.stockedProducts.toLocaleString("en-US")} ລາຍການທີ່ມີ stock`} tone="closing" />
      </div>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[1.45fr_0.75fr]">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <div><h2 className="text-sm font-bold text-slate-900 dark:text-white">ການເຄື່ອນໄຫວ 7 ວັນ</h2><p className="mt-1 text-[11px] text-slate-400">ຍອດຕົ້ນມື້, ຮັບ, ຈ່າຍ ແລະປິດທ້າຍມື້</p></div>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${net >= 0 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950" : "bg-red-50 text-red-700 dark:bg-red-950"}`}>ສຸດທິມື້ນີ້ {net >= 0 ? "+" : ""}{fmt(net)}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-xs">
              <thead><tr className="border-b border-slate-100 bg-slate-50/70 text-left text-[10px] text-slate-500 dark:border-slate-800 dark:bg-slate-950/40"><th className="px-5 py-2.5 font-semibold">ວັນທີ</th><th className="px-4 py-2.5 text-right font-semibold">ຕົ້ນມື້</th><th className="px-4 py-2.5 text-right font-semibold">ຮັບເຂົ້າ</th><th className="px-4 py-2.5 text-right font-semibold">ຈ່າຍອອກ</th><th className="px-5 py-2.5 text-right font-semibold">ທ້າຍມື້</th></tr></thead>
              <tbody>
                {stock.daily.map((row) => (
                  <tr key={row.date} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                    <td className="px-5 py-2.5 font-medium text-slate-700 dark:text-slate-200">{fmtDate(row.date)}{row.date === stock.today.date && <span className="ml-2 rounded bg-teal-50 px-1.5 py-0.5 text-[9px] font-bold text-teal-600 dark:bg-teal-950">ມື້ນີ້</span>}</td>
                    <td className="px-4 py-2.5 text-right text-slate-500">{fmt(row.opening)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-emerald-600">+{fmt(row.received)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-red-600">−{fmt(row.issued)}</td>
                    <td className="px-5 py-2.5 text-right font-bold text-slate-800 dark:text-white">{fmt(row.closing)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800"><h2 className="text-sm font-bold text-slate-900 dark:text-white">ເຄື່ອນໄຫວສູງສຸດມື້ນີ້</h2><p className="mt-1 text-[11px] text-slate-400">ຈັດອັນດັບຕາມຈຳນວນຮັບ–ຈ່າຍ</p></div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {stock.topMovers.length === 0 ? <p className="px-5 py-8 text-center text-xs text-slate-400">ມື້ນີ້ຍັງບໍ່ມີການເຄື່ອນໄຫວ</p> : stock.topMovers.map((item) => (
              <Link key={item.code} href={`/products/${encodeURIComponent(item.code)}`} className="block px-5 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-800 dark:text-white">{item.name}</p><p className="mt-0.5 font-mono text-[10px] text-slate-400">{item.code}</p></div><div className="shrink-0 text-right text-[10px]"><p className="font-bold text-emerald-600">+{fmt(item.received)}</p><p className="mt-0.5 font-bold text-red-600">−{fmt(item.issued)}</p></div></div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div><h2 className="text-sm font-bold text-slate-900 dark:text-white">ການເຄື່ອນໄຫວແຍກຕາມໝວດ</h2><p className="mt-1 text-[11px] text-slate-400">ສະເພາະໝວດທີ່ມີການຮັບ ຫຼື ຈ່າຍໃນມື້ນີ້</p></div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{stock.categoryMovements.length} ໝວດ</span>
        </div>
        {stock.categoryMovements.length === 0 ? (
          <p className="px-5 py-10 text-center text-xs text-slate-400">ມື້ນີ້ຍັງບໍ່ມີການເຄື່ອນໄຫວແຍກຕາມໝວດ</p>
        ) : (
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full min-w-[760px] text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-950">
                <tr className="border-b border-slate-200 text-left text-[10px] text-slate-500 dark:border-slate-800">
                  <th className="px-5 py-2.5 font-semibold">ໝວດ</th>
                  <th className="px-4 py-2.5 text-right font-semibold">ຕົ້ນມື້</th>
                  <th className="px-4 py-2.5 text-right font-semibold">ຮັບເຂົ້າ</th>
                  <th className="px-4 py-2.5 text-right font-semibold">ຈ່າຍອອກ</th>
                  <th className="px-4 py-2.5 text-right font-semibold">ສຸດທິ</th>
                  <th className="px-5 py-2.5 text-right font-semibold">ທ້າຍມື້</th>
                </tr>
              </thead>
              <tbody>
                {stock.categoryMovements.map((category) => {
                  const categoryNet = category.received - category.issued;
                  return (
                    <tr key={category.code || "uncategorized"} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                      <td className="px-5 py-2.5"><p className="font-semibold text-slate-800 dark:text-white">{category.name}</p><p className="mt-0.5 font-mono text-[10px] text-slate-400">{category.code || "-"}</p></td>
                      <td className="px-4 py-2.5 text-right text-slate-500">{fmt(category.opening)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-emerald-600">+{fmt(category.received)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-red-600">−{fmt(category.issued)}</td>
                      <td className={`px-4 py-2.5 text-right font-bold ${categoryNet >= 0 ? "text-emerald-600" : "text-red-600"}`}>{categoryNet >= 0 ? "+" : ""}{fmt(categoryNet)}</td>
                      <td className="px-5 py-2.5 text-right font-bold text-slate-800 dark:text-white">{fmt(category.closing)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div><h2 className="text-sm font-bold text-slate-900 dark:text-white">ການເຄື່ອນໄຫວແຍກຕາມສາງ</h2><p className="mt-1 text-[11px] text-slate-400">ຮັບ–ຈ່າຍມື້ນີ້ ແລະ ຍອດຄົງເຫຼືອ ແຍກແຕ່ລະສາງ — ກົດເພື່ອກັ່ນຕອງ</p></div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{stock.warehouseMovements.length} ສາງ</span>
        </div>
        {stock.warehouseMovements.length === 0 ? (
          <p className="px-5 py-10 text-center text-xs text-slate-400">ບໍ່ມີຂໍ້ມູນສາງໃນຂອບເຂດນີ້</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-[10px] text-slate-500 dark:border-slate-800 dark:bg-slate-950/40">
                  <th className="px-5 py-2.5 font-semibold">ສາງ</th>
                  <th className="px-4 py-2.5 text-right font-semibold">ຮັບເຂົ້າມື້ນີ້</th>
                  <th className="px-4 py-2.5 text-right font-semibold">ຈ່າຍອອກມື້ນີ້</th>
                  <th className="px-4 py-2.5 text-right font-semibold">ສຸດທິ</th>
                  <th className="px-5 py-2.5 text-right font-semibold">ຍອດຄົງເຫຼືອ</th>
                </tr>
              </thead>
              <tbody>
                {stock.warehouseMovements.map((w) => {
                  const whNet = w.received - w.issued;
                  const active = whList.includes(w.warehouse);
                  const target = mkWh(
                    active ? whList.filter((c) => c !== w.warehouse) : [...whList, w.warehouse],
                  );
                  return (
                    <tr key={w.warehouse} className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${active ? "bg-teal-50/60 dark:bg-teal-950/30" : "hover:bg-slate-50 dark:hover:bg-slate-800/40"}`}>
                      <td className="px-5 py-2.5">
                        <Link href={target} className="block">
                          <p className="font-semibold text-slate-800 dark:text-white">{w.wh_name || w.warehouse}{active && <span className="ml-2 rounded bg-teal-600 px-1.5 py-0.5 text-[9px] font-bold text-white">✓ ເລືອກ</span>}</p>
                          <p className="mt-0.5 font-mono text-[10px] text-slate-400">{w.warehouse}</p>
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-emerald-600">+{fmt(w.received)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-red-600">−{fmt(w.issued)}</td>
                      <td className={`px-4 py-2.5 text-right font-bold ${whNet >= 0 ? "text-emerald-600" : "text-red-600"}`}>{whNet >= 0 ? "+" : ""}{fmt(whNet)}</td>
                      <td className="px-5 py-2.5 text-right font-bold text-slate-800 dark:text-white">{fmt(w.closing)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Link href="/products" className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-800 shadow-sm transition hover:border-teal-300 hover:text-teal-700 dark:border-slate-800 dark:bg-slate-900 dark:text-white">□ ຄັງຂໍ້ມູນສິນຄ້າ <span className="float-right text-teal-600">→</span></Link>
        <Link href="/products?in_stock=1" className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-800 shadow-sm transition hover:border-teal-300 hover:text-teal-700 dark:border-slate-800 dark:bg-slate-900 dark:text-white">■ ສິນຄ້າທີ່ມີ stock <span className="float-right text-teal-600">→</span></Link>
        <Link href="/products" className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-800 shadow-sm transition hover:border-teal-300 hover:text-teal-700 dark:border-slate-800 dark:bg-slate-900 dark:text-white">↕ ກວດການເຄື່ອນໄຫວ <span className="float-right text-teal-600">→</span></Link>
      </div>
    </div>
  );
}
