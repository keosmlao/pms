import Link from "next/link";
import { redirect } from "next/navigation";
import { getAlerts, alertTotal } from "@/lib/alerts";
import { getIsAdmin, getUserGroupCount } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

function money(v: string) {
  const n = Number(v);
  return Number.isNaN(n) ? "-" : n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [isAdmin, groupCount] = await Promise.all([getIsAdmin(user.employeeCode), getUserGroupCount(user.employeeCode)]);
  const mineOf = groupCount > 0 ? user.employeeCode : "";
  const a = await getAlerts({ isAdmin, mineOf });
  const total = alertTotal(a);

  const cards = [
    { show: isAdmin, n: a.pendingPo, sev: "warn", title: "PO ລໍຖ້າອະນຸມັດ", desc: "ໃບສັ່ງຊື້ທີ່ລໍຖ້າທ່ານອະນຸມັດ", href: "/purchase-order/approvals", cta: "ໄປອະນຸມັດ" },
    { show: isAdmin, n: a.pendingPr, sev: "warn", title: "ໃບຂໍຊື້ ລໍຖ້າອະນຸມັດ", desc: "PR ທີ່ພະແນກຮ້ອງຂໍ ລໍກວດ", href: "/purchase-requisition?status=pending", cta: "ໄປກວດ" },
    { show: true, n: a.belowMin, sev: "crit", title: "ສິນຄ້າຕໍ່າກວ່າ min", desc: "ຄວນສັ່ງຊື້ / ເຕີມສິນຄ້າ", href: "/replenishment", cta: "ໄປເຕີມສິນຄ້າ" },
    { show: true, n: a.aboveMax, sev: "info", title: "ສິນຄ້າເກີນ max", desc: "ຫຼາຍເກີນ — ຢຸດສັ່ງຊື້", href: "/procurement", cta: "ເບິ່ງ" },
    { show: true, n: a.overdueReceipts, sev: "warn", title: "ຄ້າງຮັບເຂົ້າ ເກີນ 30 ວັນ", desc: "PO ທີ່ສັ່ງແລ້ວແຕ່ຍັງບໍ່ຮັບຄົບ", href: "/purchase-order/pending-receipt", cta: "ເບິ່ງ" },
    { show: true, n: a.overduePayables, sev: "crit", title: "ໜີ້ເກີນກຳນົດ", desc: `ຄ້າງຈ່າຍເກີນກຳນົດ ${money(a.overduePayablesAmount)}`, href: "/payables?bucket=overdue", cta: "ໄປຈ່າຍ" },
  ].filter((c) => c.show);

  const sevCls: Record<string, { ring: string; badge: string; icon: string }> = {
    crit: { ring: "border-red-200 dark:border-red-900/60", badge: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300", icon: "🔴" },
    warn: { ring: "border-amber-200 dark:border-amber-900/60", badge: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300", icon: "🟠" },
    info: { ring: "border-sky-200 dark:border-sky-900/60", badge: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300", icon: "🔵" },
  };

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 text-[11px] text-slate-400"><span>ໜ້າຫຼັກ</span><span>/</span><span className="text-slate-600">ແຈ້ງເຕືອນ &amp; ວຽກ</span></div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">ແຈ້ງເຕືອນ &amp; ວຽກ</h1>
        {total > 0 ? (
          <span className="rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-bold text-white">{total.toLocaleString("en-US")} ລາຍການ</span>
        ) : (
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">ບໍ່ມີວຽກຄ້າງ 🎉</span>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">ສະຫຼຸບສິ່ງທີ່ຕ້ອງເຮັດ {mineOf ? "· ສະເພາະກຸ່ມທ່ານ" : ""}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => {
          const s = sevCls[c.sev];
          const active = c.n > 0;
          return (
            <Link key={c.title} href={c.href}
              className={`group flex flex-col justify-between gap-3 rounded-xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900 ${active ? s.ring : "border-slate-200 opacity-70 dark:border-slate-800"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{c.title}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{c.desc}</p>
                </div>
                <span className={`shrink-0 rounded-lg px-2.5 py-1 text-lg font-bold tabular-nums ${active ? s.badge : "bg-slate-100 text-slate-400 dark:bg-slate-800"}`}>{c.n.toLocaleString("en-US")}</span>
              </div>
              <span className={`text-[11px] font-semibold ${active ? "text-teal-600 dark:text-teal-400" : "text-slate-400"}`}>{active ? `${c.cta} →` : "ບໍ່ມີ"}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
