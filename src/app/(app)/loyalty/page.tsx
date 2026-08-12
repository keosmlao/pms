import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getIsAdmin } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";
import {
  getBuOptions,
  getChannelOptions,
  getConfigLog,
  getEarnRules,
  getMissedPointDocs,
  getMissedPointStats,
  getPendingPointDocs,
  getPendingPointStats,
  getTierReach,
  getTierRules,
  getTierMembers,
  getLevels,
  countTierMembers,
  isTierSchemaReady,
  getPointGroupStats,
  getPointProducts,
  getProductPointLog,
  getMemberRewards,
  getCampaignRewards,
  getBillConditions,
  getCampaignDetailHead,
  getEarnConditions,
  getRedeemConditions,
  getRewardStats,
  countCampaignRewards,
  countPointProducts,
  isConfigSchemaReady,
  isProductLogReady,
} from "@/lib/loyalty-config";
import { getUserGroupCount } from "@/lib/products";
import CampaignEditor from "./CampaignEditor";
import EarnRuleManager from "./EarnRuleManager";
import ProductPointToggle from "./ProductPointToggle";
import { TierOverrideForm, TierRuleRow } from "./TierRuleForm";
import {
  KIP_PER_POINT,
  PAGE_SIZE,
  type Paged,
  type UserScope,
  getCampaignBalanceIssues,
  getCampaignCount,
  getCampaignSummary,
  getCampaigns,
  getDuplicateLinks,
  getLedgerYears,
  getLinkageStats,
  getLoyaltyConfig,
  getLoyaltySummary,
  getMonthlyPoints,
  getNegativeBalances,
  getPointsByBuChannel,
  getRedemptionCount,
  getRedemptions,
  getTopRewards,
  getUnderAwardStats,
  getUnderAwarded,
  getUserScope,
  getWrongDeductions,
} from "@/lib/loyalty";

const TABS = [
  { key: "overview", label: "ພາບລວມ" },
  { key: "buchannel", label: "BU × ຊ່ອງທາງ" },
  { key: "campaign", label: "ໂປຣໂມຊັ່ນ" },
  { key: "reward", label: "ແລກລາງວັນ" },
  { key: "negative", label: "ຍອດຕິດລົບ" },
  { key: "deduct", label: "ຫັກແຕ້ມຜິດ" },
  { key: "under", label: "ຄິດແຕ້ມຂາດ" },
  { key: "duplicate", label: "ບັນຊີຊ້ຳ" },
  { key: "catalog", label: "ຄັງຂອງລາງວັນ" },
  { key: "tier", label: "ລະດັບສະມາຊິກ" },
  { key: "products", label: "ສິນຄ້າຮ່ວມລາຍການ" },
  { key: "missed", label: "ບິນທີ່ຄວນໄດ້ແຕ້ມ" },
  { key: "config", label: "ຕັ້ງຄ່າ" },
] as const;

function fmt(v: string | number) {
  const n = Number(v);
  return Number.isNaN(n) ? String(v) : n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
function fmt1(v: string | number) {
  const n = Number(v);
  return Number.isNaN(n) ? String(v) : n.toLocaleString("en-US", { maximumFractionDigits: 1 });
}
function fmtDate(v: string | null) {
  if (!v) return "-";
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : v;
}

function Tile({ label, value, hint, tone = "text-slate-900 dark:text-white" }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-xl glass p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold tracking-tight ${tone}`}>{value}</p>
      {hint && <p className="mt-1 text-[10px] text-slate-400">{hint}</p>}
    </div>
  );
}

function Panel({ title, note, count, children, footer }: { title: string; note: string; count: number; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl glass shadow-sm">
      <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">{title} · {fmt(count)}</h2>
        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{note}</p>
      </div>
      {count === 0 ? <p className="px-5 py-10 text-center text-sm text-slate-400">ບໍ່ພົບລາຍການ 🎉</p> : <div className="overflow-x-auto">{children}</div>}
      {footer}
    </div>
  );
}

// Page links carry the current tab/year so paging never resets the view.
function Pager({ paged, href }: { paged: Paged<unknown>; href: (page: number) => string }) {
  if (paged.pages <= 1) return null;
  const first = Math.max(1, Math.min(paged.page - 2, paged.pages - 4));
  const nums = Array.from({ length: Math.min(5, paged.pages) }, (_, i) => first + i);
  const from = (paged.page - 1) * PAGE_SIZE + 1;
  const to = Math.min(paged.page * PAGE_SIZE, paged.total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        ສະແດງ {fmt(from)}–{fmt(to)} ຈາກ {fmt(paged.total)} ລາຍການ
      </p>
      <div className="flex items-center gap-1">
        {paged.page > 1 && (
          <Link href={href(paged.page - 1)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">‹</Link>
        )}
        {nums.map((n) => (
          <Link
            key={n}
            href={href(n)}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${n === paged.page ? "bg-teal-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"}`}
          >
            {n}
          </Link>
        ))}
        {paged.page < paged.pages && (
          <Link href={href(paged.page + 1)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">›</Link>
        )}
      </div>
    </div>
  );
}

// Shown while a tab's queries run, so the header and tab bar stay interactive.
function TableSkeleton() {
  return (
    <div className="mt-4 overflow-hidden rounded-xl glass shadow-sm">
      <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800">
        <div className="h-3.5 w-56 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="mt-2 h-2.5 w-80 animate-pulse rounded bg-slate-100 dark:bg-slate-800/60" />
      </div>
      <div className="space-y-2 p-5">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-7 animate-pulse rounded bg-slate-100 dark:bg-slate-800/60" />
        ))}
      </div>
    </div>
  );
}

const TH = "px-4 py-2.5 font-semibold";
const THEAD = "border-b border-slate-200 bg-slate-50/70 text-left text-[10px] uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950/40";
const TR = "border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50";

export default async function LoyaltyPage(props: PageProps<"/loyalty">) {
  const user = await getCurrentUser();
  if (!user) redirect("/products");

  // Admins and anyone carrying a responsibility (BU, channel or product group)
  // may open the page; the scope below is what decides how much they see, so a
  // responsible non-admin still gets in but only for their own rows.
  const [scope, isAdmin] = await Promise.all([
    getUserScope(user.employeeCode),
    getIsAdmin(user.employeeCode),
  ]);
  if (!scope.isScoped && !isAdmin) redirect("/products");

  const sp = await props.searchParams;
  const tabParam = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const tab = TABS.some((t) => t.key === tabParam) ? (tabParam as string) : "overview";
  const page = Math.max(1, Number(Array.isArray(sp.p) ? sp.p[0] : sp.p) || 1);
  const years = await getLedgerYears();
  const yParam = Number(Array.isArray(sp.y) ? sp.y[0] : sp.y);
  const year = years.includes(yParam) ? yParam : (years[0] ?? new Date().getFullYear());

  const link = (t: string) => `/loyalty?tab=${t}&y=${year}`;
  const pageLink = (n: number) => `/loyalty?tab=${tab}&y=${year}&p=${n}`;

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <span>ໜ້າຫຼັກ</span><span>/</span><span className="text-slate-600">ບໍລິຫານແຕ້ມສະສົມ</span>
      </div>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">ບໍລິຫານແຕ້ມສະສົມ LINE OA</h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            ອັດຕາສະມາຊິກ {fmt(KIP_PER_POINT)} ກີບ = 1 ແຕ້ມ · ດຶງເທື່ອລະ {PAGE_SIZE} ລາຍການ
          </p>
        </div>
        <div className="flex gap-1 rounded-xl glass p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {years.map((y) => (
            <Link
              key={y}
              href={`/loyalty?tab=${tab}&y=${y}`}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${y === year ? "bg-teal-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
            >
              {y}
            </Link>
          ))}
        </div>
      </div>

      <ScopeBanner scope={scope} />

      <nav className="mt-4 flex gap-1 overflow-x-auto rounded-xl glass p-1 shadow-sm [scrollbar-width:none] dark:border-slate-800 dark:bg-slate-900 [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={link(t.key)}
            className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition ${t.key === tab ? "bg-teal-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {/* Each tab streams in on its own so the header and tab bar are usable
          immediately instead of waiting on the slowest query. */}
      <Suspense key={`${tab}-${year}-${page}`} fallback={<TableSkeleton />}>
        {tab === "overview" && <Overview year={year} scope={scope} />}
        {tab === "buchannel" && <BuChannelTab year={year} scope={scope} />}
        {tab === "campaign" &&
          ((Array.isArray(sp.pro) ? sp.pro[0] : sp.pro) ? (
            <CampaignDetail
              proCode={String(Array.isArray(sp.pro) ? sp.pro[0] : sp.pro)}
              backHref={`/loyalty?tab=campaign&y=${year}&p=${page}`}
            />
          ) : (
            <CampaignTab scope={scope} page={page} pageLink={pageLink} year={year} />
          ))}
        {tab === "reward" && <RewardTab scope={scope} page={page} pageLink={pageLink} />}
        {tab === "negative" && <NegativeTab scope={scope} />}
        {tab === "deduct" && <DeductTab scope={scope} />}
        {tab === "under" && <UnderTab scope={scope} page={page} pageLink={pageLink} />}
        {tab === "duplicate" && <DuplicateTab scope={scope} />}
        {tab === "catalog" && (
          <CatalogTab
            page={page}
            year={year}
            tab={tab}
            live={(Array.isArray(sp.live) ? sp.live[0] : sp.live) !== "0"}
          />
        )}
        {tab === "tier" && (
          <TierTab
            year={year}
            page={page}
            tab={tab}
            isAdmin={isAdmin}
            tier={String(Array.isArray(sp.tier) ? sp.tier[0] ?? "" : sp.tier ?? "")}
          />
        )}
        {tab === "products" && (
          <ProductsTab
            employeeCode={user.employeeCode}
            page={page}
            only={Array.isArray(sp.only) ? sp.only[0] ?? "" : sp.only ?? ""}
            q={Array.isArray(sp.q) ? sp.q[0] ?? "" : sp.q ?? ""}
            year={year}
            tab={tab}
          />
        )}
        {tab === "missed" && <MissedTab year={year} page={page} pageLink={pageLink} />}
        {tab === "config" && <ConfigTab isAdmin={isAdmin} />}
      </Suspense>
    </div>
  );
}

// Makes the active restriction visible: a scoped user seeing smaller numbers
// than a colleague should be able to tell why without asking.
function ScopeBanner({ scope }: { scope: UserScope }) {
  if (!scope.isScoped) {
    return (
      <p className="mt-3 rounded-lg glass px-4 py-2 text-[11px] text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        ທ່ານບໍ່ໄດ້ຖືກກຳນົດຄວາມຮັບຜິດຊອບ — ເຫັນຂໍ້ມູນທັງໝົດ
      </p>
    );
  }
  const parts: string[] = [];
  if (scope.buCodes.length) parts.push(`BU: ${scope.buCodes.join(", ")}`);
  if (scope.channelNames.length) parts.push(`ຊ່ອງທາງ: ${scope.channelNames.join(", ")}`);
  if (scope.groups.length) parts.push(`ກຸ່ມສິນຄ້າ: ${scope.groups.length} ກຸ່ມ`);

  return (
    <p className="mt-3 rounded-lg border border-teal-200 bg-teal-50/70 px-4 py-2 text-[11px] font-medium text-teal-800 dark:border-teal-900/50 dark:bg-teal-950/20 dark:text-teal-300">
      ສະແດງສະເພາະຄວາມຮັບຜິດຊອບຂອງທ່ານ · {parts.join(" · ")}
      {scope.channelCodes.length > scope.channelNames.length && (
        <span className="ml-2 text-amber-700 dark:text-amber-400">
          (ມີລະຫັດຊ່ອງທາງທີ່ຍັງບໍ່ໄດ້ map: {scope.channelCodes.length - scope.channelNames.length})
        </span>
      )}
    </p>
  );
}

async function Overview({ year, scope }: { year: number; scope: UserScope }) {
  const [summary, linkage, monthly, campaign] = await Promise.all([
    getLoyaltySummary(year, scope),
    getLinkageStats(year, scope),
    getMonthlyPoints(scope, 18),
    getCampaignSummary(scope),
  ]);
  const maxEarn = Math.max(1, ...monthly.map((m) => m.earned));
  const linkPct = linkage.earners > 0 ? Math.round((linkage.earners_linked / linkage.earners) * 100) : 0;

  return (
    <>
      <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">ແຕ້ມສະສົມສະມາຊິກ (ODG Plus)</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label={`ແຕ້ມທີ່ອອກ ${year}`} value={fmt(summary.earned)} hint={`ລວມແຕ້ມແຖມ ${fmt(summary.extra)}`} tone="text-teal-600 dark:text-teal-400" />
        <Tile label="ແລກລາງວັນ" value={fmt(summary.redeemed)} hint={`ຫັກຄືນ (ຄືນສິນຄ້າ) ${fmt(summary.reversed)}`} tone="text-blue-600 dark:text-blue-400" />
        <Tile label="ຄົງເຫຼືອ (ພາລະຜູກພັນ)" value={fmt(summary.outstanding)} hint={`${fmt(summary.customers)} ລູກຄ້າ · ${fmt(summary.docs)} ໃບ · ຊິງຄ໌ ${fmtDate(summary.last_synced_at)}`} tone="text-orange-600 dark:text-orange-400" />
        <Tile label="ຜູກ LINE OA ແລ້ວ" value={`${linkPct}%`} hint={`${fmt(linkage.earners_linked)} / ${fmt(linkage.earners)} ຄົນທີ່ໄດ້ແຕ້ມ`} tone={linkPct < 50 ? "text-red-600 dark:text-red-400" : "text-teal-600 dark:text-teal-400"} />
      </div>

      <p className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-400">ໂປຣໂມຊັ່ນສະສົມແຕ້ມ (ທຸກປີ)</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="ແຕ້ມໂປຣທີ່ອອກ" value={fmt1(campaign.earned)} hint={`${fmt(campaign.campaigns)} ໂປຣ · ກຳລັງໃຊ້ ${fmt(campaign.active)}`} tone="text-teal-600 dark:text-teal-400" />
        <Tile label="ແລກໄປແລ້ວ" value={fmt1(campaign.redeemed)} hint={`ໂປຣທີ່ແລກໄດ້ ${fmt(campaign.redeemable)}`} tone="text-blue-600 dark:text-blue-400" />
        <Tile label="ຄົງເຫຼືອ" value={fmt1(campaign.outstanding)} hint={`${fmt(campaign.customers)} ລູກຄ້າ`} tone="text-orange-600 dark:text-orange-400" />
        <Tile label="ເຄື່ອນໄຫວຫຼ້າສຸດ" value={fmtDate(campaign.last_activity)} hint="ຈາກ odg_pomotion_colection_transection" />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">ແຕ້ມທີ່ລູກຄ້າເບິ່ງບໍ່ໄດ້</p>
          <p className="mt-2 text-2xl font-bold text-amber-700 dark:text-amber-400">{fmt(linkage.unreachable_points)}</p>
          <p className="mt-1 text-[11px] text-amber-700/80 dark:text-amber-400/70">
            ແຕ້ມປີ {year} ຂອງລູກຄ້າທີ່ຍັງບໍ່ຜູກ LINE OA — ສະສົມໄວ້ແຕ່ບໍ່ມີຊ່ອງທາງແຈ້ງເຕືອນ ຫຼື ໃຫ້ລູກຄ້າກວດເອງ
          </p>
        </div>
        <div className="rounded-xl glass p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
          <p className="text-xs font-semibold text-slate-900 dark:text-white">ບິນຂາຍທີ່ບໍ່ໄດ້ແຕ້ມເລີຍ (ປີ {year})</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{fmt(summary.zero_point_docs)} <span className="text-sm font-medium text-slate-400">/ {fmt(summary.docs)} ໃບ</span></p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            ບິນມີຍອດຂາຍແຕ່ point_amount = 0. ຄວນຢືນຢັນວ່າແມ່ນສິນຄ້າຍົກເວັ້ນຕາມນະໂຍບາຍແທ້ ຫຼື ຕັ້ງຄ່າສິນຄ້າຕົກ
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl glass p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">ແຕ້ມສະມາຊິກທີ່ອອກ ແລະ ແລກ ຕໍ່ເດືອນ (18 ເດືອນ)</h2>
        <div className="mt-4 space-y-1.5">
          {monthly.map((m) => (
            <div key={m.ym} className="flex items-center gap-3">
              <span className="w-16 shrink-0 font-mono text-[11px] text-slate-500">{m.ym}</span>
              <div className="flex h-5 flex-1 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
                <div className="h-full bg-teal-500" style={{ width: `${(m.earned / maxEarn) * 100}%` }} />
                <div className="h-full bg-blue-500" style={{ width: `${(m.redeemed / maxEarn) * 100}%` }} />
              </div>
              <span className="w-20 shrink-0 text-right text-xs font-semibold text-teal-700 dark:text-teal-400">{fmt(m.earned)}</span>
              <span className="w-20 shrink-0 text-right text-xs text-blue-600 dark:text-blue-400">{m.redeemed > 0 ? fmt(m.redeemed) : "-"}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 flex gap-4 text-[10px] text-slate-400">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded-sm bg-teal-500" /> ອອກແຕ້ມ</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded-sm bg-blue-500" /> ແລກລາງວັນ</span>
        </p>
      </div>
    </>
  );
}

async function BuChannelTab({ year, scope }: { year: number; scope: UserScope }) {
  const rows = await getPointsByBuChannel(year, scope);
  const maxEarn = Math.max(1, ...rows.map((r) => r.earned));
  const totals = rows.reduce(
    (a, r) => ({ earned: a.earned + r.earned, redeemed: a.redeemed + r.redeemed, docs: a.docs + r.docs }),
    { earned: 0, redeemed: 0, docs: 0 },
  );

  return (
    <Panel
      title={`ແຕ້ມສະມາຊິກ ແຍກ BU × ຊ່ອງທາງ · ປີ ${year}`}
      count={rows.length}
      note={`BU ແລະ ຊ່ອງທາງດຶງມາຈາກ odg_sale_detail ຕາມເລກບິນ — odg_member_point ບໍ່ມີຖັນນີ້. ບິນທີ່ຈັບຄູ່ບໍ່ໄດ້ຈະຂຶ້ນເປັນ "ບໍ່ຮູ້ BU". ລວມ ${fmt(totals.earned)} ແຕ້ມ / ${fmt(totals.docs)} ໃບ`}
    >
      <table className="w-full min-w-[820px] text-sm">
        <thead><tr className={THEAD}><th className={TH}>BU</th><th className={TH}>ຊ່ອງທາງ</th><th className={`${TH} text-right`}>ໃບ</th><th className={`${TH} text-right`}>ລູກຄ້າ</th><th className={`${TH} text-right`}>ອອກແຕ້ມ</th><th className={`${TH} text-right`}>ຫັກ/ແລກ</th><th className={`${TH} text-right`}>ຄົງເຫຼືອ</th><th className={TH}>ສັດສ່ວນ</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            // bu_name distinguishes the fallback rows (ETF / RWRT / not-yet-synced),
            // which all share bu_code '—' and would otherwise collide.
            <tr key={`${r.bu_code}|${r.bu_name}|${r.channel_name}`} className={TR}>
              <td className="px-4 py-2 font-semibold text-slate-800 dark:text-slate-100">{r.bu_name}<span className="ml-1.5 font-mono text-[10px] text-slate-400">{r.bu_code}</span></td>
              <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{r.channel_name}</td>
              <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{fmt(r.docs)}</td>
              <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{fmt(r.customers)}</td>
              <td className="px-4 py-2 text-right font-semibold text-teal-700 dark:text-teal-400">{fmt(r.earned)}</td>
              <td className="px-4 py-2 text-right text-blue-600 dark:text-blue-400">{r.redeemed > 0 ? fmt(r.redeemed) : "-"}</td>
              <td className="px-4 py-2 text-right font-semibold text-slate-800 dark:text-slate-100">{fmt(r.outstanding)}</td>
              <td className="px-4 py-2">
                <div className="h-2 w-28 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
                  <div className="h-full bg-teal-500" style={{ width: `${(r.earned / maxEarn) * 100}%` }} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

// Everything that decides how a customer earns points on this campaign and
// what they may exchange them for — the two halves live in different tables, so
// this is the only place they are shown side by side.
async function CampaignDetail({ proCode, backHref }: { proCode: string; backHref: string }) {
  const head = await getCampaignDetailHead(proCode);
  if (!head) {
    return (
      <div className="mt-4 rounded-xl glass p-6 text-center text-sm text-slate-400 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        ບໍ່ພົບໂປຣ {proCode} · <Link href={backHref} className="text-teal-700 hover:underline dark:text-teal-400">ກັບຄືນ</Link>
      </div>
    );
  }
  const [earn, bill, redeem] = await Promise.all([
    getEarnConditions(proCode),
    getBillConditions(proCode),
    getRedeemConditions(proCode),
  ]);

  return (
    <>
      <div className="mt-4 rounded-xl glass p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[11px] text-slate-500">{head.pro_code}</p>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">{head.pro_name}</h2>
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
              <span>ຊ່ອງທາງ: <strong>{head.channel_name}</strong></span>
              <span>ສະສົມ: {fmtDate(head.from_date)} → {fmtDate(head.to_date)}</span>
              <span>ແລກ: {head.start_exchange ? `${fmtDate(head.start_exchange)} → ${fmtDate(head.end_exchange)}` : "-"}</span>
              <span>ຮູບແບບ: {head.product_detail_type || "-"}</span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {head.is_active === 1 && <span className="rounded bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">ກຳລັງໃຊ້</span>}
            {head.is_redeem === 1 && <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">ແລກໄດ້</span>}
            {head.is_condition === 1 && <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">ມີເງື່ອນໄຂບິນ</span>}
            <Link href={backHref} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">← ກັບຄືນ</Link>
          </div>
        </div>
        {(head.rules || head.remark) && (
          <p className="mt-3 whitespace-pre-wrap border-t border-slate-100 pt-3 text-[11px] text-slate-600 dark:border-slate-800 dark:text-slate-300">
            {head.rules}{head.rules && head.remark ? " · " : ""}{head.remark}
          </p>
        )}
      </div>

      {bill.length > 0 && (
        <Panel
          title="ເງື່ອນໄຂລະດັບບິນ"
          count={bill.length}
          note="ຊື້ຄົບຈຳນວນທີ່ກຳນົດ ຈຶ່ງໄດ້ຄະແນນ — ຄິດຕໍ່ບິນ ບໍ່ແມ່ນຕໍ່ລາຍການ"
        >
          <table className="w-full min-w-[620px] text-sm">
            <thead><tr className={THEAD}><th className={`${TH} text-right`}>ຊື້ຄົບ</th><th className={`${TH} text-right`}>ໄດ້ຄະແນນ</th><th className={`${TH} text-right`}>ສ່ວນຫຼຸດ</th><th className={TH}>ຄິດຕໍ່</th><th className={TH}>ສິນຄ້າທີ່ນັບ</th></tr></thead>
            <tbody>
              {bill.map((b, i) => (
                <tr key={`${b.qty}-${i}`} className={TR}>
                  <td className="px-4 py-2 text-right font-bold text-slate-800 dark:text-slate-100">{fmt(b.qty)}</td>
                  <td className="px-4 py-2 text-right font-bold text-teal-700 dark:text-teal-400">{fmt1(b.points)}</td>
                  <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{Number(b.discount) > 0 ? fmt(b.discount) : "-"}</td>
                  <td className="px-4 py-2 text-xs text-slate-600 dark:text-slate-300">{b.is_bill === 1 ? "ບິນ" : "ລາຍການ"}</td>
                  <td className="px-4 py-2 font-mono text-[10px] text-slate-500"><span className="block max-w-md truncate" title={b.items}>{b.items || "-"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      <Panel
        title="ເງື່ອນໄຂການສະສົມແຕ້ມ — ຊື້ຫຍັງໄດ້ເທົ່າໃດ"
        count={earn.length}
        note="ຈາກ odg_pomotion_colection_point_detail (ຕໍ່ສິນຄ້າ) ແລະ _detail_used_multi (ແບບຊຸດ)"
      >
        <table className="w-full min-w-[880px] text-sm">
          <thead><tr className={THEAD}><th className={TH}>ຮູບແບບ</th><th className={TH}>ສິນຄ້າທີ່ຊື້</th><th className={`${TH} text-right`}>ໄດ້ຄະແນນ</th><th className={TH}>ຫົວໜ່ວຍ</th><th className={TH}>ກຸ່ມລູກຄ້າ</th><th className={TH}>ໄລຍະ</th></tr></thead>
          <tbody>
            {earn.map((e, i) => (
              <tr key={`${e.kind}-${e.item_code}-${i}`} className={TR}>
                <td className="px-4 py-2 text-[11px] text-slate-500">{e.kind}</td>
                <td className="px-4 py-2">
                  <Link href={`/products/${encodeURIComponent(e.item_code)}`} className="font-mono text-[11px] font-semibold text-blue-700 hover:underline dark:text-blue-400">{e.item_code}</Link>
                  <span className="block max-w-sm truncate text-slate-700 dark:text-slate-200" title={e.item_name}>{e.item_name}</span>
                  {e.ref_item_code && <span className="block text-[10px] text-slate-400">ອ້າງອີງ: {e.ref_item_code} {e.ref_item_name}</span>}
                </td>
                <td className="px-4 py-2 text-right font-bold text-teal-700 dark:text-teal-400">{fmt1(e.points)}</td>
                <td className="px-4 py-2 text-xs text-slate-600 dark:text-slate-300">{e.unit_code || "-"}</td>
                <td className="px-4 py-2 font-mono text-[11px] text-slate-500">{e.cust_group || "-"}</td>
                <td className="px-4 py-2 text-[11px] text-slate-500">{fmtDate(e.from_date)} → {fmtDate(e.to_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel
        title="ເງື່ອນໄຂການແລກຂອງລາງວັນ — ໃຊ້ເທົ່າໃດໄດ້ຫຍັງ"
        count={redeem.length}
        note="ຈາກ odg_pomotion_colection · ໂຄຕ້າ = ຈຳກັດຈຳນວນທັງໝົດ · ຕໍ່ລູກຄ້າ = ແລກໄດ້ຄັ້ງດຽວຕໍ່ຄົນ · ຈ່າຍເພີ່ມ = ຕ້ອງເສີມເງິນ"
      >
        <table className="w-full min-w-[980px] text-sm">
          <thead><tr className={THEAD}><th className={`${TH} text-right`}>ໃຊ້ຄະແນນ</th><th className={TH}>ໄດ້ຮັບ</th><th className={`${TH} text-right`}>ຈຳນວນ</th><th className={`${TH} text-right`}>ໂຄຕ້າ</th><th className={`${TH} text-right`}>ຈ່າຍເພີ່ມ</th><th className={`${TH} text-right`}>Stock</th><th className={`${TH} text-right`}>ຖືກແລກ</th><th className={TH}>ໝາຍເຫດ</th></tr></thead>
          <tbody>
            {redeem.map((r, i) => (
              <tr key={`${r.item_code}-${r.points}-${i}`} className={TR}>
                <td className="px-4 py-2 text-right font-bold text-blue-700 dark:text-blue-400">{fmt1(r.points)}</td>
                <td className="px-4 py-2">
                  <Link href={`/products/${encodeURIComponent(r.item_code)}`} className="font-mono text-[11px] font-semibold text-blue-700 hover:underline dark:text-blue-400">{r.item_code}</Link>
                  <span className="block max-w-sm truncate text-slate-700 dark:text-slate-200" title={r.item_name}>{r.item_name}</span>
                </td>
                <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{fmt(r.free_qty)}</td>
                <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{r.available_qty ? fmt(r.available_qty) : "ບໍ່ຈຳກັດ"}</td>
                <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{Number(r.redeem_price) > 0 ? fmt(r.redeem_price) : "-"}</td>
                <td className={`px-4 py-2 text-right font-semibold ${Number(r.stockqty) <= 0 ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-slate-200"}`}>{fmt(r.stockqty)}</td>
                <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{r.redeemed > 0 ? fmt(r.redeemed) : "-"}</td>
                <td className="px-4 py-2 text-[10px]">
                  {r.is_per_cust === 1 && <span className="mr-1 rounded bg-slate-100 px-1 py-0.5 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">ຕໍ່ລູກຄ້າ</span>}
                  {r.is_show !== 1 && <span className="rounded bg-amber-100 px-1 py-0.5 font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">ບໍ່ສະແດງ</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}

async function CampaignTab({ scope, page, pageLink, year }: { scope: UserScope; page: number; pageLink: (n: number) => string; year: number }) {
  const total = await getCampaignCount(scope);
  const [paged, channels, ready] = await Promise.all([
    getCampaigns(scope, page, total),
    getChannelOptions(),
    isConfigSchemaReady(),
  ]);
  const rows = paged.rows;
  return (
    <Panel
      title="ໂປຣໂມຊັ່ນສະສົມແຕ້ມ"
      count={total}
      footer={<Pager paged={paged} href={pageLink} />}
      note={`ຄົນລະລະບົບກັບແຕ້ມສະມາຊິກ: ຊື້ສິນຄ້າທີ່ກຳນົດແລ້ວໄດ້ຄະແນນຂອງໂປຣ ແລ້ວແລກເປັນເຄື່ອງໃນຊ່ວງແລກ. ຄະແນນຢູ່ odg_pomotion_colection_transection${scope.isScoped && !scope.channelCodes.length ? " · ໂປຣບໍ່ມີ BU ຈຶ່ງກັ່ນຕອງບໍ່ໄດ້ — ສະແດງທັງໝົດ" : ""}`}
    >
      <table className="w-full min-w-[980px] text-sm">
        <thead><tr className={THEAD}><th className={TH}>ລະຫັດ</th><th className={TH}>ຊື່ໂປຣ</th><th className={TH}>ຊ່ອງທາງ</th><th className={TH}>ໄລຍະສະສົມ</th><th className={TH}>ໄລຍະແລກ</th><th className={`${TH} text-right`}>ລູກຄ້າ</th><th className={`${TH} text-right`}>ອອກ</th><th className={`${TH} text-right`}>ແລກ</th><th className={`${TH} text-right`}>ຄົງເຫຼືອ</th><th className={TH} /></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.pro_code} className={TR}>
              <td className="px-4 py-2 font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">
                {r.pro_code}
                {r.is_active === 1 && <span className="ml-1.5 rounded bg-teal-100 px-1 py-0.5 text-[9px] font-bold text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">ON</span>}
                {r.is_redeem === 1 && <span className="ml-1 rounded bg-blue-100 px-1 py-0.5 text-[9px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">ແລກ</span>}
              </td>
              <td className="px-4 py-2">
                <Link
                  href={`/loyalty?tab=campaign&y=${year}&pro=${encodeURIComponent(r.pro_code)}`}
                  className="block max-w-md truncate font-medium text-blue-700 hover:underline dark:text-blue-400"
                  title={`${r.pro_name} — ເບິ່ງເງື່ອນໄຂ`}
                >
                  {r.pro_name}
                </Link>
              </td>
              <td className="px-4 py-2 text-xs text-slate-600 dark:text-slate-300">{r.channel_name}</td>
              <td className="px-4 py-2 text-[11px] text-slate-500">{fmtDate(r.from_date)} → {fmtDate(r.to_date)}</td>
              <td className="px-4 py-2 text-[11px] text-slate-500">{r.start_exchange ? `${fmtDate(r.start_exchange)} → ${fmtDate(r.end_exchange)}` : "-"}</td>
              <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{fmt(r.customers)}</td>
              <td className="px-4 py-2 text-right font-semibold text-teal-700 dark:text-teal-400">{fmt1(r.earned)}</td>
              <td className="px-4 py-2 text-right text-blue-600 dark:text-blue-400">{Number(r.redeemed) > 0 ? fmt1(r.redeemed) : "-"}</td>
              <td className={`px-4 py-2 text-right font-semibold ${Number(r.balance) < 0 ? "text-red-600 dark:text-red-400" : "text-slate-800 dark:text-slate-100"}`}>{fmt1(r.balance)}</td>
              <td className="px-4 py-2">
                {ready ? (
                  <CampaignEditor
                    channels={channels}
                    campaign={{
                      pro_code: r.pro_code,
                      pro_name: r.pro_name,
                      channel_group: r.channel_group,
                      from_date: r.from_date,
                      to_date: r.to_date,
                      start_exchange: r.start_exchange,
                      end_exchange: r.end_exchange,
                      is_active: r.is_active,
                      is_redeem: r.is_redeem,
                    }}
                  />
                ) : (
                  <span className="text-[10px] text-slate-400">ຕ້ອງ migration 003</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

async function RewardTab({ scope, page, pageLink }: { scope: UserScope; page: number; pageLink: (n: number) => string }) {
  const total = await getRedemptionCount(scope);
  const [paged, top, issues] = await Promise.all([
    getRedemptions(scope, page, total),
    getTopRewards(scope, 20),
    getCampaignBalanceIssues(scope, PAGE_SIZE),
  ]);
  const rows = paged.rows;

  return (
    <>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl glass shadow-sm">
          <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">ຂອງລາງວັນທີ່ຖືກແລກຫຼາຍສຸດ</h2>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">ຮຽງຕາມຄະແນນທີ່ໃຊ້ໄປ</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead><tr className={THEAD}><th className={TH}>ສິນຄ້າ</th><th className={`${TH} text-right`}>ຄັ້ງ</th><th className={`${TH} text-right`}>ຈຳນວນ</th><th className={`${TH} text-right`}>ຄະແນນ</th></tr></thead>
              <tbody>
                {top.map((r) => (
                  <tr key={r.item_code} className={TR}>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-200"><span className="block max-w-xs truncate" title={r.item_name}>{r.item_name || r.item_code}</span><span className="font-mono text-[10px] text-slate-400">{r.item_code}</span></td>
                    <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{fmt(r.times)}</td>
                    <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{fmt1(r.qty)}</td>
                    <td className="px-4 py-2 text-right font-semibold text-blue-600 dark:text-blue-400">{fmt1(r.points)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <Panel
          title="ຍອດຄະແນນໂປຣທີ່ມີບັນຫາ"
          count={issues.length}
          note="ຍອດໃນ odg_pomotion_colection_total ບໍ່ກົງກັບ ledger ຫຼື ຕິດລົບ — ນີ້ຄືຕົວເລກທີ່ລູກຄ້າເຫັນໃນ LINE OA"
        >
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className={THEAD}><th className={TH}>ລູກຄ້າ</th><th className={TH}>ໂປຣ</th><th className={`${TH} text-right`}>ຍອດເກັບ</th><th className={`${TH} text-right`}>ledger</th><th className={TH}>ອາການ</th></tr></thead>
            <tbody>
              {issues.map((r) => (
                <tr key={`${r.cust_code}-${r.pro_code}`} className={TR}>
                  <td className="px-4 py-2"><span className="block font-mono text-[11px] text-slate-500">{r.cust_code}</span><span className="text-slate-700 dark:text-slate-200">{r.cust_name || "-"}</span></td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">{r.pro_code}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${Number(r.stored) < 0 ? "text-red-600 dark:text-red-400" : "text-slate-800 dark:text-slate-100"}`}>{fmt1(r.stored)}</td>
                  <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{fmt1(r.ledger)}</td>
                  <td className="px-4 py-2 text-[11px] text-amber-700 dark:text-amber-400">{r.kind}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel
        title="ໃບແລກລາງວັນ (RWSO)"
        count={total}
        footer={<Pager paged={paged} href={pageLink} />}
        note="ເຄື່ອງທີ່ມອບໃຫ້ລູກຄ້າແລກດ້ວຍຄະແນນໂປຣ. BU ບໍ່ມີໃນໃບແລກ ເພາະບໍ່ແມ່ນໃບຂາຍ — ຈຶ່ງແຍກໄດ້ພຽງຊ່ອງທາງຂອງໂປຣ"
      >
        <table className="w-full min-w-[980px] text-sm">
          <thead><tr className={THEAD}><th className={TH}>ໃບແລກ</th><th className={TH}>ວັນທີ</th><th className={TH}>ລູກຄ້າ</th><th className={TH}>ຂອງລາງວັນ</th><th className={`${TH} text-right`}>ຈຳນວນ</th><th className={`${TH} text-right`}>ຄະແນນ</th><th className={TH}>ໂປຣ / ຊ່ອງທາງ</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.doc_no} className={TR}>
                <td className="px-4 py-2 font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">{r.doc_no}</td>
                <td className="px-4 py-2 text-xs text-slate-500">{fmtDate(r.doc_date)}</td>
                <td className="px-4 py-2"><span className="block font-mono text-[11px] text-slate-500">{r.cust_code}</span><span className="text-slate-700 dark:text-slate-200">{r.cust_name || "-"}</span></td>
                <td className="px-4 py-2 text-slate-700 dark:text-slate-200"><span className="block max-w-sm truncate" title={r.item_name}>{r.item_name || r.item_code}</span><span className="font-mono text-[10px] text-slate-400">{r.item_code}</span></td>
                <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{fmt1(r.qty)}</td>
                <td className="px-4 py-2 text-right font-bold text-blue-600 dark:text-blue-400">{fmt1(r.points)}</td>
                <td className="px-4 py-2 text-[11px] text-slate-500"><span className="font-mono">{r.pro_code}</span> · {r.channel_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}

async function NegativeTab({ scope }: { scope: UserScope }) {
  const rows = await getNegativeBalances(scope);
  return (
    <Panel
      title="ລູກຄ້າທີ່ຍອດປິດປີຕິດລົບ"
      count={rows.length}
      note="ຖືກຫັກແຕ້ມຫຼາຍກວ່າທີ່ໄດ້ຮັບໃນປີນັ້ນ — ເກີດຈາກການແລກລາງວັນເກີນຍອດ ຫຼື ໃບຄືນສິນຄ້າຫັກແຕ້ມທີ່ບໍ່ເຄີຍໃຫ້. ຄິດຈາກຍອດລວມທັງປີ ບໍ່ແມ່ນລຳດັບລາຍການ ເພາະບິນຂາຍຖືກ backfill ໃສ່ຫຼັງ"
    >
      <table className="w-full min-w-[720px] text-sm">
        <thead><tr className={THEAD}><th className={TH}>ປີ</th><th className={TH}>ລະຫັດລູກຄ້າ</th><th className={TH}>ຊື່</th><th className={`${TH} text-right`}>ໄດ້ຮັບ</th><th className={`${TH} text-right`}>ຖືກຫັກ</th><th className={`${TH} text-right`}>ຍອດ</th><th className={TH}>LINE OA</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.yr}-${r.cust_code}`} className={TR}>
              <td className="px-4 py-2 text-xs text-slate-500">{r.yr}</td>
              <td className="px-4 py-2 font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">{r.cust_code}</td>
              <td className="px-4 py-2 text-slate-700 dark:text-slate-200">{r.name || "-"}</td>
              <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{fmt(r.earned)}</td>
              <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{fmt(r.burned)}</td>
              <td className="px-4 py-2 text-right font-bold text-red-600 dark:text-red-400">{fmt(r.balance)}</td>
              <td className="px-4 py-2 text-xs">{r.line_id ? <span className="text-teal-600 dark:text-teal-400">ຜູກແລ້ວ</span> : <span className="text-slate-400">ຍັງບໍ່ຜູກ</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

async function DeductTab({ scope }: { scope: UserScope }) {
  const rows = await getWrongDeductions(scope);
  const total = rows.reduce((s, r) => s + r.points_taken, 0);
  return (
    <Panel
      title="ໃບຄືນສິນຄ້າທີ່ຫັກແຕ້ມທັ້ງທີ່ບິນຂາຍບໍ່ໄດ້ແຕ້ມ"
      count={rows.length}
      note={`ລວມແຕ້ມທີ່ຫັກຜິດ ${fmt(total)} ແຕ້ມ. ໃບ CNK ບໍ່ມີ ref_doc ຈຶ່ງຈັບຄູ່ບິນຂາຍດ້ວຍ (ລະຫັດລູກຄ້າ + ຍອດເງິນ) — ຖືເປັນລາຍການທີ່ຄວນຢືນຢັນກ່ອນຄືນແຕ້ມ`}
    >
      <table className="w-full min-w-[820px] text-sm">
        <thead><tr className={THEAD}><th className={TH}>ໃບຄືນ</th><th className={TH}>ວັນທີ</th><th className={TH}>ລູກຄ້າ</th><th className={`${TH} text-right`}>ຍອດເງິນ</th><th className={`${TH} text-right`}>ແຕ້ມທີ່ຖືກຫັກ</th><th className={TH}>ບິນຂາຍທີ່ໄດ້ 0 ແຕ້ມ</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.doc_no} className={TR}>
              <td className="px-4 py-2 font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">{r.doc_no}</td>
              <td className="px-4 py-2 text-xs text-slate-500">{fmtDate(r.doc_date)}</td>
              <td className="px-4 py-2 text-slate-700 dark:text-slate-200"><span className="block font-mono text-[11px] text-slate-500">{r.cust_code}</span>{r.name || "-"}</td>
              <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{fmt(r.total_amount)}</td>
              <td className="px-4 py-2 text-right font-bold text-red-600 dark:text-red-400">-{fmt(r.points_taken)}</td>
              <td className="px-4 py-2 font-mono text-[11px] text-slate-500">{r.sale_docs}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

async function UnderTab({ scope, page, pageLink }: { scope: UserScope; page: number; pageLink: (n: number) => string }) {
  const stats = await getUnderAwardStats(scope);
  const paged = await getUnderAwarded(scope, page, stats.affected);
  const rows = paged.rows;
  const pct = stats.docs > 0 ? ((stats.affected / stats.docs) * 100).toFixed(1) : "0";
  return (
    <>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Tile label="ບິນທີ່ຄິດແຕ້ມຂາດ" value={fmt(stats.affected)} hint={`${pct}% ຂອງ ${fmt(stats.docs)} ບິນທີ່ໄດ້ແຕ້ມ`} tone="text-amber-600 dark:text-amber-400" />
        <Tile label="ແຕ້ມທີ່ຂາດລວມ" value={fmt(stats.points_lost)} hint="ທຽບກັບການຄິດຈາກຍອດລວມທັງບິນ" tone="text-amber-600 dark:text-amber-400" />
        <Tile label="ອັດຕາທີ່ໃຊ້ທຽບ" value={`${fmt(KIP_PER_POINT)} ກີບ`} hint="= 1 ແຕ້ມ (ປັດລົງ)" />
      </div>
      <Panel
        title="ບິນທີ່ໄດ້ແຕ້ມໜ້ອຍກວ່າສູດ"
        count={stats.affected}
        footer={<Pager paged={paged} href={pageLink} />}
        note="ຕ່າງກັນ 1-3 ແຕ້ມຕໍ່ບິນ ເຊິ່ງເປັນຮູບແບບຂອງການປັດລົງແຍກແຕ່ລະລາຍການສິນຄ້າ ແທນທີ່ຈະປັດຈາກຍອດລວມ. ຕ້ອງຕັດສິນໃຈວ່າຈະຢືນຢັນສູດໃດເປັນມາດຕະຖານ"
      >
        <table className="w-full min-w-[720px] text-sm">
          <thead><tr className={THEAD}><th className={TH}>ບິນ</th><th className={TH}>ວັນທີ</th><th className={TH}>ລູກຄ້າ</th><th className={`${TH} text-right`}>ຍອດຄິດແຕ້ມ</th><th className={`${TH} text-right`}>ໄດ້ຈິງ</th><th className={`${TH} text-right`}>ຕາມສູດ</th><th className={`${TH} text-right`}>ຂາດ</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.doc_no} className={TR}>
                <td className="px-4 py-2 font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">{r.doc_no}</td>
                <td className="px-4 py-2 text-xs text-slate-500">{fmtDate(r.doc_date)}</td>
                <td className="px-4 py-2 font-mono text-[11px] text-slate-500">{r.cust_code}</td>
                <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{fmt(r.point_amount)}</td>
                <td className="px-4 py-2 text-right text-slate-700 dark:text-slate-200">{fmt(r.awarded)}</td>
                <td className="px-4 py-2 text-right text-slate-500">{fmt(r.expected)}</td>
                <td className="px-4 py-2 text-right font-bold text-amber-600 dark:text-amber-400">-{fmt(r.shortfall)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}

async function DuplicateTab({ scope }: { scope: UserScope }) {
  const rows = await getDuplicateLinks(scope);
  return (
    <Panel
      title="LINE ID ດຽວ ຜູກຫຼາຍລະຫັດລູກຄ້າ"
      count={rows.length}
      note="ສ່ວນຫຼາຍແມ່ນເບີໂທດຽວກັນທີ່ບັນທຶກຄົນລະຮູບແບບ. ແຕ້ມຈະແຍກໄປຕາມລະຫັດທີ່ບິນຂາຍໃຊ້ ເຮັດໃຫ້ລູກຄ້າເຫັນພຽງສ່ວນດຽວໃນ LINE OA"
    >
      <table className="w-full min-w-[760px] text-sm">
        <thead><tr className={THEAD}><th className={TH}>LINE ID</th><th className={TH}>ລະຫັດລູກຄ້າ</th><th className={TH}>ຊື່</th><th className={`${TH} text-right`}>ຈຳນວນບັນຊີ</th><th className={`${TH} text-right`}>ແຕ້ມລວມ</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.line_id} className={TR}>
              <td className="px-4 py-2 font-mono text-[10px] text-slate-500">{r.line_id}</td>
              <td className="px-4 py-2 font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">{r.cust_codes}</td>
              <td className="px-4 py-2 text-xs text-slate-600 dark:text-slate-300">{r.names}</td>
              <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{r.customers}</td>
              <td className="px-4 py-2 text-right font-semibold text-slate-800 dark:text-slate-100">{fmt(r.total_points)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

// Turns yearly points into Silver / Gold / Platinum, which is what gates the
// member reward catalogue. Before this existed the tiers were unreachable.
async function TierTab({
  year,
  page,
  tab,
  isAdmin,
  tier,
}: {
  year: number;
  page: number;
  tab: string;
  isAdmin: boolean;
  tier: string;
}) {
  const ready = await isTierSchemaReady();
  if (!ready) {
    return (
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">ຍັງບໍ່ມີລະບົບລະດັບສະມາຊິກ</p>
        <p className="mt-1 text-[11px] leading-relaxed text-amber-700/90 dark:text-amber-400/80">
          ລາງວັນ Gold 25 ລາຍການ ແລະ Platinum 24 ລາຍການ ກັ່ນດ້ວຍ <span className="font-mono">card_type</span> ແຕ່ບໍ່ມີຕາຕະລາງໃດກຳນົດລະດັບໃຫ້ລູກຄ້າ
          ຈຶ່ງບໍ່ມີໃຜແລກໄດ້. ໃຫ້ຣັນ <span className="font-mono">db/migrations/005_member_tier.sql</span> ກ່ອນ
        </p>
      </div>
    );
  }

  const [rules, total, levels] = await Promise.all([
    getTierRules(year),
    countTierMembers(year, tier),
    getLevels(),
  ]);
  const members = await getTierMembers(year, tier, PAGE_SIZE, (page - 1) * PAGE_SIZE);
  const paged = { rows: members, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
  const base = `/loyalty?tab=${tab}&y=${year}`;

  return (
    <>
      <Panel
        title={`ເກນລະດັບ · ປີ ${year}`}
        count={rules.length}
        note="ລະດັບທີ່ເກນສູງສຸດທີ່ຍັງບໍ່ເກີນແຕ້ມຂອງລູກຄ້າ ຄືລະດັບທີ່ໄດ້ · ຖ້າ 'ລາງວັນ' ເປັນ 0 ແປວ່າໄດ້ລະດັບແຕ່ບໍ່ມີຫຍັງໃຫ້ແລກ"
      >
        <table className="w-full min-w-[820px] text-sm">
          <thead><tr className={THEAD}><th className={TH}>ລະດັບ</th><th className={`${TH} text-right`}>ເກນແຕ້ມ</th><th className={`${TH} text-right`}>ຈະໄດ້ກີ່ຄົນ</th><th className={`${TH} text-right`}>ລາງວັນທີ່ແລກໄດ້</th><th className={TH}>ສະຖານະ</th><th className={`${TH} text-right`}>ແກ້ເກນ</th></tr></thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className={TR}>
                <td className="px-4 py-2 font-semibold text-slate-800 dark:text-slate-100">{r.tier_name}</td>
                <td className="px-4 py-2 text-right font-bold text-slate-800 dark:text-slate-100">{fmt(r.min_points)}</td>
                <td className="px-4 py-2 text-right text-slate-700 dark:text-slate-200">{fmt(r.members)}</td>
                <td className={`px-4 py-2 text-right font-semibold ${r.rewards === 0 ? "text-red-600 dark:text-red-400" : "text-teal-700 dark:text-teal-400"}`}>{fmt(r.rewards)}</td>
                <td className="px-4 py-2 text-xs">{r.is_active === 1 ? <span className="text-teal-600 dark:text-teal-400">ໃຊ້ງານ</span> : <span className="text-slate-400">ປິດ</span>}</td>
                <td className="px-4 py-2"><TierRuleRow id={r.id} minPoints={r.min_points} isActive={r.is_active} note={r.note} disabled={!isAdmin} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link href={base} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${tier === "" ? "bg-teal-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"}`}>ທັງໝົດ</Link>
        {levels.map((l) => (
          <Link key={l.code} href={`${base}&tier=${l.code}`} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${tier === l.code ? "bg-teal-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"}`}>{l.name}</Link>
        ))}
      </div>

      <Panel
        title={`ສະມາຊິກ ແລະ ລະດັບ · ປີ ${year}`}
        count={total}
        footer={<Pager paged={paged} href={(n) => `${base}${tier ? `&tier=${tier}` : ""}&p=${n}`} />}
        note={`ຮຽງຕາມແຕ້ມຫຼາຍໄປໜ້ອຍ${isAdmin ? " · ຕັ້ງລະດັບເປັນລາຍຄົນໄດ້ (ຊະນະເກນ)" : ""}`}
      >
        <table className="w-full min-w-[860px] text-sm">
          <thead><tr className={THEAD}><th className={TH}>ລູກຄ້າ</th><th className={`${TH} text-right`}>ແຕ້ມ {year}</th><th className={TH}>ລະດັບ</th><th className={TH}>LINE OA</th><th className={`${TH} text-right`}>ຕັ້ງມື</th></tr></thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.cust_code} className={TR}>
                <td className="px-4 py-2"><span className="block font-mono text-[11px] text-slate-500">{m.cust_code}</span><span className="text-slate-700 dark:text-slate-200">{m.cust_name || "-"}</span></td>
                <td className="px-4 py-2 text-right font-bold text-slate-800 dark:text-slate-100">{fmt(m.points)}</td>
                <td className="px-4 py-2 text-xs">
                  <span className={m.tier_code ? "font-semibold text-teal-700 dark:text-teal-400" : "text-slate-400"}>{m.tier_name}</span>
                  {m.is_override && <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">ຕັ້ງມື</span>}
                </td>
                <td className="px-4 py-2 text-xs">{m.line_linked ? <span className="text-teal-600 dark:text-teal-400">ຜູກແລ້ວ</span> : <span className="text-slate-400">ຍັງບໍ່ຜູກ</span>}</td>
                <td className="px-4 py-2"><TierOverrideForm custCode={m.cust_code} year={year} current={m.is_override ? m.tier_code ?? "" : ""} levels={levels} disabled={!isAdmin} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}

// What a customer can actually pick, as opposed to the reward tab which shows
// what has already been handed over.
async function CatalogTab({ page, year, tab, live }: { page: number; year: number; tab: string; live: boolean }) {
  const [stats, member, total, tiers] = await Promise.all([
    getRewardStats(),
    getMemberRewards(live),
    countCampaignRewards(live),
    getTierReach(),
  ]);
  const campaign = await getCampaignRewards(live, PAGE_SIZE, (page - 1) * PAGE_SIZE);
  const paged = { rows: campaign, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
  const base = `/loyalty?tab=${tab}&y=${year}`;
  const outTotal = stats.member_out + stats.campaign_out;

  return (
    <>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="ລາງວັນສະມາຊິກ (ກຳລັງໃຊ້)" value={fmt(stats.member_live)} hint="ແລກດ້ວຍແຕ້ມສະສົມ ແບ່ງຕາມລະດັບ" tone="text-teal-600 dark:text-teal-400" />
        <Tile label="ລາງວັນໂປຣ (ກຳລັງໃຊ້)" value={fmt(stats.campaign_live)} hint="ແລກດ້ວຍຄະແນນຂອງແຕ່ລະໂປຣ" tone="text-blue-600 dark:text-blue-400" />
        <Tile label="ລາງວັນທີ່ stock ໝົດ" value={fmt(outTotal)} hint={`ສະມາຊິກ ${fmt(stats.member_out)} · ໂປຣ ${fmt(stats.campaign_out)}`} tone={outTotal > 0 ? "text-red-600 dark:text-red-400" : "text-slate-500"} />
        <div className="rounded-xl glass p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">ສະແດງ</p>
          <div className="mt-2 flex gap-1">
            {[["1", "ກຳລັງໃຊ້"], ["0", "ທັງໝົດ"]].map(([v, label]) => (
              <Link
                key={v}
                href={`${base}&live=${v}`}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${(live ? "1" : "0") === v ? "bg-teal-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"}`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {outTotal > 0 && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50/60 p-4 dark:border-red-900/40 dark:bg-red-950/20">
          <p className="text-xs font-semibold text-red-800 dark:text-red-300">ມີລາງວັນທີ່ແລກໄດ້ແຕ່ stock ໝົດ</p>
          <p className="mt-1 text-[11px] text-red-700/90 dark:text-red-400/80">
            {fmt(outTotal)} ລາຍການຍັງເປີດໃຫ້ລູກຄ້າແລກ ແຕ່ຍອດຄົງເຫຼືອເປັນ 0 — ລູກຄ້າຈະເສຍແຕ້ມແລ້ວບໍ່ໄດ້ຮັບເຄື່ອງ ຫຼື ຕ້ອງລໍ
          </p>
        </div>
      )}

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">ໃຜແລກລາງວັນສະມາຊິກໄດ້?</p>
          <p className="mt-2 text-2xl font-bold text-amber-700 dark:text-amber-400">
            {fmt(stats.members_with_tier)} <span className="text-sm font-medium text-amber-700/70">/ {fmt(stats.members_total)}</span>
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-amber-700/80 dark:text-amber-400/70">
            ລາງວັນກັ່ນດ້ວຍລະດັບ Silver/Gold/Platinum ແຕ່<strong>ບໍ່ມີຕາຕະລາງໃດກຳນົດລະດັບໃຫ້ລູກຄ້າ</strong> — ມີພຽງຂໍ້ຄວາມໃນ cust_group_2.
            ແປວ່າລາງວັນ Gold/Platinum ເກືອບບໍ່ມີໃຜເຂົ້າເຖິງໄດ້
          </p>
        </div>
        <div className="rounded-xl glass p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
          <p className="text-xs font-semibold text-slate-900 dark:text-white">ກຸ່ມລູກຄ້າທີ່ມີຢູ່ຈິງ</p>
          <div className="mt-3 space-y-1.5">
            {tiers.slice(0, 8).map((t) => (
              <div key={t.tier} className="flex items-center gap-3">
                <span className="w-44 shrink-0 truncate text-[11px] text-slate-600 dark:text-slate-300" title={t.tier}>{t.tier}</span>
                <div className="h-3 flex-1 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
                  <div className="h-full bg-slate-400 dark:bg-slate-600" style={{ width: `${(t.members / Math.max(1, tiers[0]?.members ?? 1)) * 100}%` }} />
                </div>
                <span className="w-16 shrink-0 text-right text-[11px] font-semibold text-slate-700 dark:text-slate-200">{fmt(t.members)}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-slate-400">ຈາກ member_lineoa_info.cust_group_2 / cust_group_1</p>
        </div>
      </div>

      <Panel
        title="ຄັງລາງວັນສະມາຊິກ (ແລກດ້ວຍແຕ້ມສະສົມ)"
        count={member.length}
        note="ຈາກ odg_pomotion_point · ແບ່ງຕາມລະດັບສະມາຊິກ. ບໍ່ມີຖັນ 'ຖືກແລກກີ່ຄັ້ງ' ເພາະໃບ RWRT ບໍ່ບັນທຶກວ່າແລກເອົາຂອງໃດ"
      >
        <table className="w-full min-w-[860px] text-sm">
          <thead><tr className={THEAD}><th className={TH}>ສິນຄ້າ</th><th className={TH}>ລະດັບ</th><th className={`${TH} text-right`}>ແຕ້ມທີ່ໃຊ້</th><th className={`${TH} text-right`}>ຈຳນວນ</th><th className={TH}>ໄລຍະ</th><th className={`${TH} text-right`}>Stock</th><th className={TH}>ສະຖານະ</th></tr></thead>
          <tbody>
            {member.map((r) => (
              <tr key={`${r.ic_code}-${r.tier}-${r.from_date}`} className={TR}>
                <td className="px-4 py-2">
                  <Link href={`/products/${encodeURIComponent(r.ic_code)}`} className="font-mono text-[11px] font-semibold text-blue-700 hover:underline dark:text-blue-400">{r.ic_code}</Link>
                  <span className="block max-w-sm truncate text-slate-700 dark:text-slate-200" title={r.item_name}>{r.item_name}</span>
                </td>
                <td className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300">{r.tier}</td>
                <td className="px-4 py-2 text-right font-bold text-teal-700 dark:text-teal-400">{fmt(r.points)}</td>
                <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{fmt(r.free_qty)}</td>
                <td className="px-4 py-2 text-[11px] text-slate-500">{fmtDate(r.from_date)} → {fmtDate(r.to_date)}</td>
                <td className={`px-4 py-2 text-right font-semibold ${Number(r.stockqty) <= 0 ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-slate-200"}`}>{fmt(r.stockqty)}</td>
                <td className="px-4 py-2 text-xs">
                  {r.live
                    ? <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-bold text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">ກຳລັງໃຊ້</span>
                    : <span className="text-slate-400">ໝົດໄລຍະ</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel
        title="ຄັງລາງວັນຂອງໂປຣ (ແລກດ້ວຍຄະແນນໂປຣ)"
        count={total}
        footer={<Pager paged={paged} href={(n) => `${base}&live=${live ? "1" : "0"}&p=${n}`} />}
        note="ຈາກ odg_pomotion_colection (qty = ຄະແນນທີ່ໃຊ້, free_ic_code = ຂອງທີ່ໄດ້) · ຢືນຢັນຕົງກັບໃບ RWSO ຈິງ"
      >
        <table className="w-full min-w-[1000px] text-sm">
          <thead><tr className={THEAD}><th className={TH}>ໂປຣ</th><th className={TH}>ຂອງລາງວັນ</th><th className={`${TH} text-right`}>ຄະແນນທີ່ໃຊ້</th><th className={`${TH} text-right`}>ຈຳນວນ</th><th className={TH}>ໄລຍະ</th><th className={`${TH} text-right`}>Stock</th><th className={`${TH} text-right`}>ຖືກແລກ</th><th className={TH}>ສະຖານະ</th></tr></thead>
          <tbody>
            {campaign.map((r) => (
              <tr key={`${r.pro_code}-${r.item_code}-${r.from_date}`} className={TR}>
                <td className="px-4 py-2"><span className="block font-mono text-[11px] font-semibold text-slate-600 dark:text-slate-300">{r.pro_code}</span><span className="block max-w-[14rem] truncate text-[11px] text-slate-500" title={r.pro_name}>{r.pro_name}</span></td>
                <td className="px-4 py-2">
                  <Link href={`/products/${encodeURIComponent(r.item_code)}`} className="font-mono text-[11px] font-semibold text-blue-700 hover:underline dark:text-blue-400">{r.item_code}</Link>
                  <span className="block max-w-xs truncate text-slate-700 dark:text-slate-200" title={r.item_name}>{r.item_name}</span>
                </td>
                <td className="px-4 py-2 text-right font-bold text-blue-700 dark:text-blue-400">{fmt1(r.points)}</td>
                <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{fmt(r.free_qty)}</td>
                <td className="px-4 py-2 text-[11px] text-slate-500">{fmtDate(r.from_date)} → {fmtDate(r.to_date)}</td>
                <td className={`px-4 py-2 text-right font-semibold ${Number(r.stockqty) <= 0 ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-slate-200"}`}>{fmt(r.stockqty)}</td>
                <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{r.redeemed > 0 ? fmt(r.redeemed) : "-"}</td>
                <td className="px-4 py-2 text-xs">
                  {r.live
                    ? <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-bold text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">ກຳລັງໃຊ້</span>
                    : <span className="text-slate-400">ປິດ</span>}
                  {r.live && r.is_show !== 1 && <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400">ບໍ່ສະແດງ</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}

// The flag that decides whether a sale line earns member points at all. Scoped
// by product group for non-admins, matching how the rest of the app splits
// product ownership.
async function ProductsTab({
  employeeCode,
  page,
  only,
  q,
  year,
  tab,
}: {
  employeeCode: string;
  page: number;
  only: string;
  q: string;
  year: number;
  tab: string;
}) {
  const isOwner = (await getUserGroupCount(employeeCode)) > 0;
  const mineOf = isOwner ? employeeCode : "";
  const filter = only === "yes" || only === "no" ? only : "";

  const [groups, total, logReady] = await Promise.all([
    getPointGroupStats(mineOf),
    countPointProducts(mineOf, filter, q),
    isProductLogReady(),
  ]);
  const [rows, log] = await Promise.all([
    getPointProducts(mineOf, filter, q, PAGE_SIZE, (page - 1) * PAGE_SIZE),
    logReady ? getProductPointLog(20) : Promise.resolve([]),
  ]);

  const totalItems = groups.reduce((s, g) => s + g.items, 0);
  const totalHave = groups.reduce((s, g) => s + g.have_point, 0);
  const paged = { rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
  const base = `/loyalty?tab=${tab}&y=${year}`;
  const filterLink = (v: string) => `${base}&only=${v}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Tile label="ສິນຄ້າຮ່ວມລາຍການ" value={fmt(totalHave)} hint={`${totalItems > 0 ? Math.round((totalHave / totalItems) * 100) : 0}% ຂອງ ${fmt(totalItems)} ລາຍການ`} tone="text-teal-600 dark:text-teal-400" />
        <Tile label="ບໍ່ຮ່ວມລາຍການ" value={fmt(totalItems - totalHave)} hint="ຂາຍແລ້ວລູກຄ້າບໍ່ໄດ້ແຕ້ມ" tone="text-slate-500" />
        <Tile label="ປະຫວັດການປ່ຽນ" value={logReady ? fmt(log.length) : "—"} hint={logReady ? "ການປ່ຽນລ່າສຸດ (ບໍ່ນັບຄ່າເລີ່ມຕົ້ນ)" : "ຕ້ອງຣັນ migration 004"} />
      </div>

      {!logReady && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">ຍັງແກ້ທຸງບໍ່ໄດ້</p>
          <p className="mt-1 text-[11px] leading-relaxed text-amber-700/90 dark:text-amber-400/80">
            <span className="font-mono">ic_inventory_detail.have_point</span> ບໍ່ມີປະຫວັດ ຈຶ່ງກວດຍ້ອນຫຼັງບໍ່ໄດ້ວ່າຕອນຂາຍສິນຄ້າຮ່ວມລາຍການຢູ່ບໍ່.
            ໃຫ້ຣັນ <span className="font-mono">db/migrations/004_product_point_history.sql</span> ກ່ອນ ຈຶ່ງຈະເປີດໃຫ້ແກ້ — ເພື່ອບໍ່ໃຫ້ເກີດຄຳຖາມທີ່ຕອບບໍ່ໄດ້ຄືເທື່ອນີ້ອີກ
          </p>
        </div>
      )}

      <div className="mt-4 rounded-xl glass p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">ສັດສ່ວນຕາມກຸ່ມສິນຄ້າ</h2>
        <div className="mt-4 space-y-2">
          {groups.map((g) => (
            <div key={g.group_main} className="flex items-center gap-3">
              <span className="w-48 shrink-0 truncate text-xs text-slate-600 dark:text-slate-300" title={g.group_name}>{g.group_name}</span>
              <div className="h-4 flex-1 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
                <div className="h-full bg-teal-500" style={{ width: `${g.pct}%` }} />
              </div>
              <span className="w-28 shrink-0 text-right text-xs text-slate-500">{fmt(g.have_point)} / {fmt(g.items)}</span>
              <span className="w-12 shrink-0 text-right text-xs font-semibold text-slate-700 dark:text-slate-200">{g.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {[["", "ທັງໝົດ"], ["yes", "ຮ່ວມລາຍການ"], ["no", "ບໍ່ຮ່ວມ"]].map(([v, label]) => (
          <Link
            key={v}
            href={filterLink(v)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${filter === v ? "bg-teal-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"}`}
          >
            {label}
          </Link>
        ))}
        <form action={base} className="ml-auto flex items-center gap-2">
          <input type="hidden" name="tab" value={tab} />
          <input type="hidden" name="y" value={year} />
          {filter && <input type="hidden" name="only" value={filter} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="ຄົ້ນຫາລະຫັດ / ຊື່ສິນຄ້າ"
            className="h-9 w-56 rounded-lg glass px-3 text-xs text-slate-900 outline-none focus:border-teal-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
          <button type="submit" className="h-9 rounded-lg bg-slate-800 px-3 text-xs font-bold text-white dark:bg-slate-700">ຄົ້ນຫາ</button>
        </form>
      </div>

      <Panel
        title="ສິນຄ້າ"
        count={total}
        footer={<Pager paged={paged} href={(n) => `${filterLink(filter)}&p=${n}`} />}
        note={`ທຸງ have_point ໃນ ic_inventory_detail — ຕັດສິນວ່າແຖວຂາຍນັ້ນຈະນັບເຂົ້າ point_amount ຫຼືບໍ່${mineOf ? " · ສະເພາະກຸ່ມທີ່ທ່ານຮັບຜິດຊອບ" : ""}`}
      >
        <table className="w-full min-w-[820px] text-sm">
          <thead><tr className={THEAD}><th className={TH}>ລະຫັດ</th><th className={TH}>ຊື່ສິນຄ້າ</th><th className={TH}>ກຸ່ມ / ຍີ່ຫໍ້</th><th className={`${TH} text-right`}>ຄົງເຫຼືອ</th><th className={TH}>ສະຖານະ</th><th className={`${TH} text-right`}>ປ່ຽນ</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code} className={TR}>
                <td className="px-4 py-2 font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">
                  <Link href={`/products/${encodeURIComponent(r.code)}`} className="text-blue-700 hover:underline dark:text-blue-400">{r.code}</Link>
                </td>
                <td className="px-4 py-2 text-slate-700 dark:text-slate-200"><span className="block max-w-sm truncate" title={r.name}>{r.name}</span></td>
                <td className="px-4 py-2 text-[11px] text-slate-500">{r.group_name}<span className="block text-[10px] text-slate-400">{r.brand}</span></td>
                <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{fmt(r.stockqty)}</td>
                <td className="px-4 py-2 text-xs">
                  {r.have_point === 1
                    ? <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-bold text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">ຮ່ວມລາຍການ</span>
                    : <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">ບໍ່ຮ່ວມ</span>}
                </td>
                <td className="px-4 py-2"><ProductPointToggle icCode={r.code} havePoint={r.have_point} disabled={!logReady} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {logReady && (
        <Panel title="ປະຫວັດການປ່ຽນທຸງ" count={log.length} note="ບໍ່ນັບແຖວຄ່າເລີ່ມຕົ້ນທີ່ migration ໃສ່ໄວ້">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className={THEAD}><th className={TH}>ເວລາ</th><th className={TH}>ສິນຄ້າ</th><th className={TH}>ຈາກ → ເປັນ</th><th className={TH}>ເຫດຜົນ</th><th className={TH}>ຜູ້ແກ້</th></tr></thead>
            <tbody>
              {log.map((l) => (
                <tr key={l.id} className={TR}>
                  <td className="px-4 py-2 text-[11px] text-slate-500">{l.changed_at?.slice(0, 16)}</td>
                  <td className="px-4 py-2"><span className="block font-mono text-[11px] text-slate-500">{l.ic_code}</span><span className="block max-w-xs truncate text-slate-700 dark:text-slate-200">{l.item_name}</span></td>
                  <td className="px-4 py-2 text-xs text-slate-600 dark:text-slate-300">
                    {l.before_value === 1 ? "ຮ່ວມ" : "ບໍ່ຮ່ວມ"} → <span className="font-semibold">{l.after_value === 1 ? "ຮ່ວມ" : "ບໍ່ຮ່ວມ"}</span>
                  </td>
                  <td className="px-4 py-2 text-[11px] text-slate-500">{l.reason || "-"}</td>
                  <td className="px-4 py-2 text-xs text-slate-600 dark:text-slate-300">{l.changed_by_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </>
  );
}

// Documents whose products carry the flag today but which awarded no points.
async function MissedTab({ year, page, pageLink }: { year: number; page: number; pageLink: (n: number) => string }) {
  const [stats, pending] = await Promise.all([getMissedPointStats(year), getPendingPointStats(year)]);
  const [rows, pendingRows] = await Promise.all([
    getMissedPointDocs(year, PAGE_SIZE, (page - 1) * PAGE_SIZE),
    getPendingPointDocs(year, PAGE_SIZE, 0),
  ]);
  const paged = { rows, total: stats.docs, page, pages: Math.max(1, Math.ceil(stats.docs / PAGE_SIZE)) };

  return (
    <>
      <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">ບິນທີ່ຍັງບໍ່ໄດ້ຄິດແຕ້ມເລີຍ</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        <Tile label="ບິນຂາຍທີ່ບໍ່ມີໃນ ledger" value={fmt(pending.pending_docs)} hint={`ປີ ${year} · ບໍ່ມີແຖວໃນ odg_member_point ເລີຍ`} tone="text-amber-600 dark:text-amber-400" />
        <Tile label="ໃນນັ້ນ ລູກຄ້າເປັນສະມາຊິກ" value={fmt(pending.member_docs)} hint="ກຸ່ມນີ້ຄືກຸ່ມທີ່ຄ້າງຄິດແຕ້ມແທ້" tone="text-red-600 dark:text-red-400" />
        <Tile label="ບໍ່ແມ່ນສະມາຊິກ" value={fmt(pending.non_member_docs)} hint="ບໍ່ໄດ້ແຕ້ມຢູ່ແລ້ວ — ປົກກະຕິ" tone="text-slate-500" />
      </div>

      <Panel
        title={`ບິນສະມາຊິກທີ່ລໍຄິດແຕ້ມ · ${fmt(pending.member_docs)} ໃບ`}
        count={pendingRows.length}
        note={`ສະແດງ ${PAGE_SIZE} ໃບຫຼ້າສຸດ · ເກົ່າສຸດ ${fmtDate(pending.oldest)} — ຖ້າມີບິນເກົ່າຫຼາຍວັນ ແປວ່າບໍ່ແມ່ນແຕ່ sync ຊ້າ ແຕ່ຄ້າງຄິດແທ້`}
      >
        <table className="w-full min-w-[820px] text-sm">
          <thead><tr className={THEAD}><th className={TH}>ບິນ</th><th className={TH}>ວັນທີ</th><th className={TH}>ລູກຄ້າ</th><th className={TH}>ກຸ່ມ</th><th className={`${TH} text-right`}>ຍອດ (ກີບ)</th><th className={`${TH} text-right`}>ລໍມາແລ້ວ</th></tr></thead>
          <tbody>
            {pendingRows.map((r) => (
              <tr key={r.doc_no} className={TR}>
                <td className="px-4 py-2 font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">{r.doc_no}</td>
                <td className="px-4 py-2 text-xs text-slate-500">{fmtDate(r.doc_date)}</td>
                <td className="px-4 py-2"><span className="block font-mono text-[11px] text-slate-500">{r.cust_code}</span><span className="text-slate-700 dark:text-slate-200">{r.cust_name || "-"}</span></td>
                <td className="px-4 py-2 text-[11px] text-slate-500">{r.cust_group}</td>
                <td className="px-4 py-2 text-right text-slate-700 dark:text-slate-200">{fmt(r.amount)}</td>
                <td className={`px-4 py-2 text-right font-semibold ${r.days_waiting > 7 ? "text-red-600 dark:text-red-400" : "text-slate-500"}`}>{fmt(r.days_waiting)} ວັນ</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <p className="mt-6 text-xs font-bold uppercase tracking-wide text-slate-400">ບິນທີ່ມີແຖວແຕ້ມ ແຕ່ໄດ້ 0</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Tile label={`ບິນທີ່ຄວນໄດ້ແຕ້ມ ${year}`} value={fmt(stats.docs)} hint="ມີສິນຄ້າຮ່ວມລາຍການ ແຕ່ບິນໄດ້ 0 ແຕ້ມ" tone="text-red-600 dark:text-red-400" />
        <Tile label="ຍອດເງິນທີ່ຄວນຄິດແຕ້ມ" value={fmt(stats.eligible_kip)} hint="ກີບ" tone="text-red-600 dark:text-red-400" />
        <Tile label="ແຕ້ມທີ່ຄວນໄດ້" value={fmt(stats.expected_points)} hint={`ທີ່ ${fmt(KIP_PER_POINT)} ກີບ/ແຕ້ມ`} tone="text-red-600 dark:text-red-400" />
      </div>

      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">ອ່ານຕົວເລກນີ້ແນວໃດ</p>
        <p className="mt-1 text-[11px] leading-relaxed text-amber-700/90 dark:text-amber-400/80">
          ຄິດຈາກທຸງ <span className="font-mono">have_point</span> <strong>ປັດຈຸບັນ</strong>. ຖ້າສິນຄ້າຖືກປ່ຽນເປັນ &quot;ຮ່ວມລາຍການ&quot; ຫຼັງວັນຂາຍ ບິນເກົ່າກໍຈະຂຶ້ນມາໃນນີ້ທັງທີ່ຕອນນັ້ນຖືກຕ້ອງແລ້ວ.
          ຍັງແຍກສອງກໍລະນີນີ້ບໍ່ໄດ້ຈົນກວ່າຈະມີປະຫວັດ (migration 004) — ຢ່າຫາກໍຄືນແຕ້ມທັງໝົດໂດຍບໍ່ກວດເປັນລາຍບິນກ່ອນ
        </p>
      </div>

      <Panel
        title={`ບິນທີ່ມີສິນຄ້າຮ່ວມລາຍການ ແຕ່ໄດ້ 0 ແຕ້ມ · ປີ ${year}`}
        count={stats.docs}
        footer={<Pager paged={paged} href={pageLink} />}
        note="ຮຽງຕາມຍອດເງິນທີ່ຄວນຄິດແຕ້ມ ຫຼາຍໄປໜ້ອຍ"
      >
        <table className="w-full min-w-[820px] text-sm">
          <thead><tr className={THEAD}><th className={TH}>ບິນ</th><th className={TH}>ວັນທີ</th><th className={TH}>ລູກຄ້າ</th><th className={`${TH} text-right`}>ຍອດບິນ</th><th className={`${TH} text-right`}>ຍອດຮ່ວມລາຍການ</th><th className={`${TH} text-right`}>ແຕ້ມທີ່ຄວນໄດ້</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.doc_no} className={TR}>
                <td className="px-4 py-2 font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">{r.doc_no}</td>
                <td className="px-4 py-2 text-xs text-slate-500">{fmtDate(r.doc_date)}</td>
                <td className="px-4 py-2"><span className="block font-mono text-[11px] text-slate-500">{r.cust_code}</span><span className="text-slate-700 dark:text-slate-200">{r.cust_name || "-"}</span></td>
                <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{fmt(r.total_amount)}</td>
                <td className="px-4 py-2 text-right font-semibold text-slate-800 dark:text-slate-100">{fmt(r.eligible_kip)}</td>
                <td className="px-4 py-2 text-right font-bold text-red-600 dark:text-red-400">{fmt(r.expected_points)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}

async function EarnRuleSection({ isAdmin }: { isAdmin: boolean }) {
  const [rules, channels, bus] = await Promise.all([
    getEarnRules(),
    getChannelOptions(),
    getBuOptions(),
  ]);
  return <EarnRuleManager rules={rules} channels={channels} bus={bus} canEditAll={isAdmin} />;
}

async function ConfigLogPanel() {
  const entries = await getConfigLog(30);
  return (
    <Panel
      title="ບັນທຶກການແກ້ໄຂຕັ້ງຄ່າ"
      count={entries.length}
      note="ທຸກການແກ້ກົດອັດຕາ ແລະ ຫົວໂປຣ ຈາກໜ້ານີ້ຈະຖືກບັນທຶກໄວ້ພ້ອມຄ່າກ່ອນ/ຫຼັງ"
    >
      <table className="w-full min-w-[720px] text-sm">
        <thead><tr className={THEAD}><th className={TH}>ເວລາ</th><th className={TH}>ຜູ້ແກ້</th><th className={TH}>ລາຍການ</th><th className={TH}>ການກະທຳ</th><th className={TH}>ຄ່າຫຼັງແກ້</th></tr></thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className={TR}>
              <td className="px-4 py-2 text-[11px] text-slate-500">{e.changed_at?.slice(0, 16)}</td>
              <td className="px-4 py-2 text-slate-700 dark:text-slate-200">{e.changed_by_name}</td>
              <td className="px-4 py-2 font-mono text-[11px] text-slate-500">{e.entity} · {e.entity_id}</td>
              <td className="px-4 py-2 text-xs text-slate-600 dark:text-slate-300">{e.action}</td>
              <td className="px-4 py-2 font-mono text-[10px] text-slate-400"><span className="block max-w-md truncate" title={e.summary}>{e.summary}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

async function ConfigTab({ isAdmin }: { isAdmin: boolean }) {
  const [rows, ready] = await Promise.all([getLoyaltyConfig(), isConfigSchemaReady()]);
  const mismatch = rows.filter((r) => Number(r.earn_kip_per_point) > 0 && Number(r.earn_kip_per_point) !== KIP_PER_POINT);

  return (
    <>
      {ready ? (
        <EarnRuleSection isAdmin={isAdmin} />
      ) : (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">ຍັງຕັ້ງອັດຕາຕໍ່ຊ່ອງທາງບໍ່ໄດ້</p>
          <p className="mt-1 text-[11px] leading-relaxed text-amber-700/90 dark:text-amber-400/80">
            ດຽວນີ້ອັດຕາ {fmt(KIP_PER_POINT)} ກີບ/ແຕ້ມ ຝັງຢູ່ໃນໂຄ້ດ POS/AR ຈຶ່ງແຍກຕາມຊ່ອງທາງບໍ່ໄດ້.
            ໃຫ້ຣັນ <span className="font-mono">db/migrations/003_loyalty_config_standard.sql</span> ກ່ອນ
            ແລ້ວໜ້ານີ້ຈະສະແດງຕົວຈັດການກົດອັດຕາໃຫ້ອັດຕະໂນມັດ (ຍັງບໍ່ໄດ້ຣັນໃຫ້ ຕາມທີ່ຕົກລົງ)
          </p>
        </div>
      )}

      {mismatch.length > 0 && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50/60 p-4 dark:border-red-900/40 dark:bg-red-950/20">
          <p className="text-xs font-semibold text-red-800 dark:text-red-300">ອັດຕາຄິດແຕ້ມບໍ່ກົງກັນ</p>
          <p className="mt-1 text-[11px] text-red-700/90 dark:text-red-400/80">
            ລະບົບ POS/AR ທີ່ຂຽນ odg_member_point ໃຊ້ {fmt(KIP_PER_POINT)} ກີບ/ແຕ້ມ ແຕ່ app_loyalty_config ຕັ້ງໄວ້{" "}
            {mismatch.map((r) => fmt(r.earn_kip_per_point)).join(", ")} ກີບ/ແຕ້ມ. ຖ້າເປີດໃຊ້ລະບົບໃໝ່ໂດຍບໍ່ແກ້ກ່ອນ ລູກຄ້າຈະໄດ້ແຕ້ມຄົນລະຈຳນວນຈາກຍອດຊື້ດຽວກັນ
          </p>
        </div>
      )}
      {ready && <ConfigLogPanel />}

      <Panel title="app_loyalty_config" count={rows.length} note="ຕາຕະລາງຕັ້ງຄ່າຂອງລະບົບແຕ້ມລຸ້ນໃໝ່ (ຍັງບໍ່ໄດ້ໃຊ້ງານຈິງ — ຕາຕະລາງ ledger ຂອງມັນຍັງຫວ່າງເປົ່າ)">
        <table className="w-full min-w-[620px] text-sm">
          <thead><tr className={THEAD}><th className={TH}>ID</th><th className={TH}>ຊື່ແຕ້ມ</th><th className={`${TH} text-right`}>ກີບ/ແຕ້ມ</th><th className={TH}>enabled</th><th className={TH}>is_active</th><th className={TH}>ອັບເດດ</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={TR}>
                <td className="px-4 py-2 font-mono text-xs text-slate-500">{r.id}</td>
                <td className="px-4 py-2 text-slate-700 dark:text-slate-200">{r.point_name || "-"}</td>
                <td className={`px-4 py-2 text-right font-semibold ${Number(r.earn_kip_per_point) > 0 && Number(r.earn_kip_per_point) !== KIP_PER_POINT ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-slate-200"}`}>{fmt(r.earn_kip_per_point)}</td>
                <td className="px-4 py-2 text-xs">{r.enabled ? <span className="text-teal-600 dark:text-teal-400">true</span> : <span className="text-slate-400">false</span>}</td>
                <td className="px-4 py-2 text-xs">{r.is_active ? <span className="text-teal-600 dark:text-teal-400">true</span> : <span className="text-slate-400">false</span>}</td>
                <td className="px-4 py-2 text-xs text-slate-500">{fmtDate(r.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
