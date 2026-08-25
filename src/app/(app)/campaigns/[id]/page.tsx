import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader, PageShell, MetricCard } from "@/components/PageShell";
import {
  getCampaignByDepartment,
  getCampaignByMonth,
  getCampaignBySalesperson,
  getCampaignWithLines,
  scopeLabel,
} from "@/lib/campaigns";
import { getIsAdmin } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

function fmt(v: string | number, digits = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: digits }) : String(v);
}

const SPLIT_LABEL: Record<string, string> = {
  prorata: "ແບ່ງຕາມສັດສ່ວນຍອດ",
  equal: "ແບ່ງເທົ່າກັນ",
  none: "ບໍ່ແບ່ງ — ເປັນເງິນທີມ",
};

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

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const campaignId = Number(id);
  if (!Number.isFinite(campaignId)) notFound();

  const [campaign, isAdmin] = await Promise.all([
    getCampaignWithLines(campaignId),
    getIsAdmin(user.employeeCode),
  ]);
  if (!campaign) notFound();

  const [byDept, bySales, byMonth, scope] = await Promise.all([
    getCampaignByDepartment(campaignId),
    getCampaignBySalesperson(campaignId),
    getCampaignByMonth(campaignId),
    scopeLabel(campaign.scope_kind, campaign.scope_codes),
  ]);

  const cur = campaign.reward_currency === "THB" ? "ບາດ" : campaign.reward_currency;
  const paceRatio = campaign.daysTotal > 0 ? campaign.daysElapsed / campaign.daysTotal : 0;
  const monthMax = Math.max(1, ...byMonth.map((m) => Number(m.units)));

  return (
    <PageShell>
      <PageHeader
        section="ໂຄງການສົ່ງເສີມການຂາຍ"
        title={campaign.name}
        description={
          <>
            {campaign.date_from} → {campaign.date_to} · ຂອບເຂດ: {scope}
            {campaign.description ? <> · {campaign.description}</> : null}
          </>
        }
        action={
          <div className="flex gap-2">
            <Link href="/campaigns" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              ← ກັບຄືນ
            </Link>
            {isAdmin ? (
              <Link href={`/campaigns/${campaign.id}/edit`} className="rounded-lg bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-teal-700">
                ແກ້ໄຂ
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="ລາຍຮັບພິເສດລວມປັດຈຸບັນ" value={`${fmt(campaign.totalBonus)} ${cur}`} valueClassName="text-emerald-600 dark:text-emerald-400" note="ຕາມຂັ້ນທີ່ບັນລຸແລ້ວ + ລາຍຮັບຕໍ່ຕົວ" />
        <MetricCard label="ໝວດໃນໂຄງການ" value={campaign.lines.length} note={`ບັນລຸເປົ້າ 100% ແລ້ວ ${campaign.lines.filter((l) => l.pct >= 100).length} ໝວດ`} />
        <MetricCard label="ເວລາທີ່ຜ່ານໄປ" value={`${campaign.daysElapsed}/${campaign.daysTotal} ວັນ`} note={`${fmt(paceRatio * 100, 0)}% ຂອງໄລຍະໂຄງການ`} />
        <MetricCard label="ພະນັກງານທີ່ມີສ່ວນຮ່ວມ" value={bySales.length} note={`${byDept.length} ພະແນກ`} />
      </div>

      {campaign.note ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-4 py-2.5 text-[11px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          ໝາຍເຫດ: {campaign.note}
        </p>
      ) : null}

      {/* ---- ໝວດສິນຄ້າ ---- */}
      <div className="mt-6 space-y-4">
        {campaign.lines.map((line) => {
          const projected = paceRatio > 0 ? line.actual / paceRatio : 0;
          return (
            <div key={line.id} className="glass rounded-xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{line.name}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    ໝວດ: {line.categories.join(", ") || "-"}
                    {line.brands.length ? ` · ແບຣນ: ${line.brands.join(", ")}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-bold ${pctTone(line.pct)}`}>{fmt(line.pct, 1)}%</p>
                  <p className="text-[11px] text-slate-400">
                    {fmt(line.actual)} / {fmt(line.target100)} ໜ່ວຍ
                  </p>
                </div>
              </div>

              <div className="relative mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div className={`h-full rounded-full ${barTone(line.pct)}`} style={{ width: `${Math.min(100, Math.max(0, line.pct))}%` }} />
                <div className="absolute top-0 h-full w-px bg-slate-900/60 dark:bg-white/70" style={{ left: `${Math.min(100, paceRatio * 100)}%` }} />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-[10px] uppercase text-slate-500 dark:border-slate-800">
                        <th className="py-2 font-semibold">ຂັ້ນ</th>
                        <th className="py-2 text-right font-semibold">ເປົ້າ (ໜ່ວຍ)</th>
                        <th className="py-2 text-right font-semibold">% ຈິງ</th>
                        <th className="py-2 text-right font-semibold">ລາຍຮັບພິເສດ</th>
                        <th className="py-2 text-right font-semibold">ສະຖານະ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {line.tiers.map((t) => {
                        const realPct = line.target100 > 0 ? (Number(t.target_qty) / line.target100) * 100 : 0;
                        const labelled = Number(t.pct);
                        const mismatch = Math.abs(realPct - labelled) >= 1;
                        const reached = line.actual >= Number(t.target_qty);
                        const isCurrent = line.achievedTier?.id === t.id;
                        return (
                          <tr key={t.id} className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${isCurrent ? "bg-emerald-50/60 dark:bg-emerald-500/10" : ""}`}>
                            <td className="py-2 font-semibold text-slate-700 dark:text-slate-200">{fmt(t.pct)}%</td>
                            <td className="py-2 text-right text-slate-700 dark:text-slate-200">{fmt(t.target_qty)}</td>
                            <td className={`py-2 text-right ${mismatch ? "font-semibold text-amber-600 dark:text-amber-400" : "text-slate-400"}`}>
                              {fmt(realPct, 1)}%{mismatch ? " ⚠" : ""}
                            </td>
                            <td className="py-2 text-right font-semibold text-slate-800 dark:text-white">{fmt(t.bonus_amount)}</td>
                            <td className="py-2 text-right">
                              {isCurrent ? (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">ຂັ້ນປັດຈຸບັນ</span>
                              ) : reached ? (
                                <span className="text-[10px] text-slate-400">ຜ່ານແລ້ວ</span>
                              ) : (
                                <span className="text-[10px] text-slate-400">ຂາດ {fmt(Number(t.target_qty) - line.actual)}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {line.tiers.some((t) => {
                    const realPct = line.target100 > 0 ? (Number(t.target_qty) / line.target100) * 100 : 0;
                    return Math.abs(realPct - Number(t.pct)) >= 1;
                  }) ? (
                    <p className="mt-2 text-[10px] text-amber-600 dark:text-amber-400">
                      ⚠ ຂັ້ນທີ່ໝາຍໄວ້ ຕົວເລກເປົ້າບໍ່ກົງກັບ % ທີ່ຂຽນ (ຄິດຈາກເປົ້າ 100%)
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-900/40">
                  <div className="flex justify-between">
                    <span className="text-slate-500">ລາຍຮັບຕາມຂັ້ນ</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{fmt(line.tierBonus)} {cur}</span>
                  </div>
                  {Number(line.unit_bonus_per_unit) > 0 ? (
                    <div className="flex justify-between">
                      <span className="text-slate-500">
                        {line.unit_bonus_brands.join("/")} × {fmt(line.unit_bonus_per_unit)}/ຕົວ
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {fmt(line.unitBonusQty)} ຕົວ = {fmt(line.unitBonus)} {cur}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex justify-between border-t border-slate-200 pt-2 dark:border-slate-700">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">ລວມ</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{fmt(line.totalBonus)} {cur}</span>
                  </div>
                  <div className="border-t border-slate-200 pt-2 text-[11px] text-slate-500 dark:border-slate-700">
                    {line.nextTier ? (
                      <>ຂາດອີກ <span className="font-bold text-slate-800 dark:text-white">{fmt(line.gapToNext)}</span> ໜ່ວຍ ຈຶ່ງຮອດຂັ້ນ {fmt(line.nextTier.pct)}% (+{fmt(Number(line.nextTier.bonus_amount) - line.tierBonus)} {cur})</>
                    ) : (
                      <>ບັນລຸຂັ້ນສູງສຸດແລ້ວ</>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    ຄາດຄະເນເມື່ອຈົບໂຄງການ: <span className="font-bold text-slate-800 dark:text-white">{fmt(projected)}</span> ໜ່ວຍ ({fmt(line.target100 > 0 ? (projected / line.target100) * 100 : 0, 0)}%)
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ---- ຈັງຫວະລາຍເດືອນ ---- */}
      {byMonth.length > 0 ? (
        <div className="mt-6 glass rounded-xl p-5">
          <p className="text-sm font-bold text-slate-900 dark:text-white">ຈັງຫວະຂາຍລາຍເດືອນ (ທຸກໝວດໃນໂຄງການ)</p>
          <div className="mt-4 flex items-end gap-4">
            {byMonth.map((m) => (
              <div key={m.ym} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">{fmt(m.units)}</span>
                <div className="w-full rounded-t bg-teal-500/80" style={{ height: `${Math.max(4, (Number(m.units) / monthMax) * 120)}px` }} />
                <span className="text-[10px] text-slate-400">{m.ym}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* ---- ພະແນກ ---- */}
        <div className="glass overflow-hidden rounded-xl">
          <p className="px-5 pt-5 text-sm font-bold text-slate-900 dark:text-white">ແຍກຕາມພະແນກ</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-[10px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950/40">
                  <th className="px-5 py-2.5 font-semibold">ພະແນກ</th>
                  <th className="px-5 py-2.5 font-semibold">BU</th>
                  <th className="px-5 py-2.5 text-right font-semibold">ໜ່ວຍ</th>
                </tr>
              </thead>
              <tbody>
                {byDept.map((d) => (
                  <tr key={d.department_code} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                    <td className="px-5 py-2.5 text-slate-800 dark:text-slate-100">{d.department_name}</td>
                    <td className="px-5 py-2.5 text-slate-400">{d.bu_name}</td>
                    <td className="px-5 py-2.5 text-right font-semibold text-slate-900 dark:text-white">{fmt(d.units)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ---- ພະນັກງານ ---- */}
        <div className="glass overflow-hidden rounded-xl">
          <p className="px-5 pt-5 text-sm font-bold text-slate-900 dark:text-white">ອັນດັບພະນັກງານຂາຍ</p>
          <p className="px-5 pt-1 text-[11px] text-slate-400">ເງິນ = ສ່ວນແບ່ງຂອງແຕ່ລະຄົນ ({SPLIT_LABEL[campaign.split_rule] ?? campaign.split_rule}) + ລາຍຮັບຕໍ່ຕົວຂອງຕົນເອງ</p>
          <div className="mt-3 max-h-[420px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0">
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                  <th className="px-5 py-2.5 font-semibold">#</th>
                  <th className="px-5 py-2.5 font-semibold">ພະນັກງານ</th>
                  <th className="px-5 py-2.5 text-right font-semibold">ບິນ</th>
                  <th className="px-5 py-2.5 text-right font-semibold">ໜ່ວຍ</th>
                  <th className="px-5 py-2.5 text-right font-semibold">ເງິນ ({cur})</th>
                </tr>
              </thead>
              <tbody>
                {bySales.map((s, i) => (
                  <tr key={`${s.salename}-${i}`} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                    <td className="px-5 py-2.5 text-slate-400">{i + 1}</td>
                    <td className="px-5 py-2.5">
                      <p className="font-medium text-slate-800 dark:text-slate-100">{s.salename}</p>
                      <p className="text-[10px] text-slate-400">{s.department_name}</p>
                      {s.absorbed.length ? (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400">
                          ຮັບແທນ: {s.absorbed.join(", ")}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-5 py-2.5 text-right text-slate-500">{fmt(s.bills)}</td>
                    <td className="px-5 py-2.5 text-right font-semibold text-slate-900 dark:text-white">{fmt(s.units)}</td>
                    <td className="px-5 py-2.5 text-right font-bold text-amber-600 dark:text-amber-400">{fmt(s.bonus)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <p className="mt-4 text-[11px] text-slate-400">
        ຍອດຂາຍຈິງມາຈາກ odg_sale_detail (ຮັບຄືນເປັນຄ່າລົບ ຈຶ່ງຫັກອອກແລ້ວ)
        {campaign.exclude_gifts ? " · ຕັດຂອງແຖມ (ລາຄາ 0 ຫຼື ກຸ່ມ 98) ອອກແລ້ວ" : " · ລວມຂອງແຖມນຳ"} ·
        ຍັງບໍ່ໄດ້ກວດເງື່ອນໄຂ “ເກັບເງິນຄົບ” ເພາະຕ້ອງດຶງຈາກຂໍ້ມູນໜີ້ AR ຕ່າງຫາກ
      </p>
    </PageShell>
  );
}
