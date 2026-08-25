import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, PageShell } from "@/components/PageShell";
import { listCampaignSummaries } from "@/lib/campaigns";
import { getIsAdmin } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

function fmt(n: number, digits = 0) {
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

function pctTone(pct: number) {
  if (pct >= 100) return "text-emerald-600 dark:text-emerald-400";
  if (pct >= 90) return "text-teal-600 dark:text-teal-400";
  if (pct >= 80) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function barTone(pct: number) {
  if (pct >= 100) return "bg-emerald-500";
  if (pct >= 90) return "bg-teal-500";
  if (pct >= 80) return "bg-amber-500";
  return "bg-red-500";
}

export default async function CampaignsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const isAdmin = await getIsAdmin(user.employeeCode);
  const campaigns = await listCampaignSummaries();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <PageShell>
      <PageHeader
        section="ໂຄງການສົ່ງເສີມການຂາຍ"
        title="ໂຄງການສົ່ງເສີມການຂາຍ"
        description="ຄວາມຄືບໜ້າຂອງແຕ່ລະໂຄງການ ທຽບກັບເປົ້າໜ່ວຍ ພ້ອມເງິນລາຍຮັບພິເສດທີ່ຈະໄດ້ຮັບ · ຍອດຂາຍຈິງດຶງຈາກ odg_sale_detail (ຫັກຮັບຄືນແລ້ວ)"
        action={
          isAdmin ? (
            <Link
              href="/campaigns/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-700"
            >
              + ສ້າງໂຄງການ
            </Link>
          ) : null
        }
      />

      {campaigns.length === 0 ? (
        <div className="mt-6 glass rounded-xl px-5 py-12 text-center text-sm text-slate-400">ຍັງບໍ່ມີໂຄງການ</div>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {campaigns.map((c) => {
            const running = today >= c.date_from && today <= c.date_to;
            const paceExpected = c.daysTotal > 0 ? (c.daysElapsed / c.daysTotal) * 100 : 0;
            return (
              <Link
                key={c.id}
                href={`/campaigns/${c.id}`}
                className="glass block rounded-xl p-5 transition hover:ring-2 hover:ring-teal-500/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{c.name}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {c.date_from} → {c.date_to} · {c.lineCount} ໝວດ ·{" "}
                      {c.scope_kind === "all" ? "ທຸກພະແນກ" : `ສະເພາະ ${c.scope_codes.length} ພະແນກ`}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      running
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                        : today > c.date_to
                          ? "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                          : "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
                    }`}
                  >
                    {running ? "ກຳລັງດຳເນີນ" : today > c.date_to ? "ສິ້ນສຸດແລ້ວ" : "ຍັງບໍ່ເລີ່ມ"}
                  </span>
                </div>

                <div className="mt-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">ຄວາມຄືບໜ້າຕ່ຳສຸດ</p>
                    <p className={`text-2xl font-bold ${pctTone(c.minPct)}`}>{fmt(c.minPct, 1)}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">ລາຍຮັບພິເສດປັດຈຸບັນ</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {fmt(c.totalBonus)}{" "}
                      <span className="text-xs font-medium text-slate-400">
                        {c.reward_currency === "THB" ? "ບາດ" : c.reward_currency}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className={`h-full rounded-full ${barTone(c.minPct)}`}
                    style={{ width: `${Math.min(100, Math.max(0, c.minPct))}%` }}
                  />
                  <div
                    className="absolute top-0 h-full w-px bg-slate-900/60 dark:bg-white/70"
                    style={{ left: `${Math.min(100, paceExpected)}%` }}
                    title="ຈັງຫວະຕາມເວລາທີ່ຜ່ານໄປ"
                  />
                </div>
                <p className="mt-1.5 text-[10px] text-slate-400">
                  ຜ່ານໄປ {c.daysElapsed}/{c.daysTotal} ວັນ ({fmt(paceExpected, 0)}% ຂອງເວລາ) · ເສັ້ນດຳ = ຈັງຫວະທີ່ຄວນຮອດ
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
