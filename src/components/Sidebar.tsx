"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/home", label: "ໜ້າຫຼັກ", icon: HomeIcon, adminOnly: false },
  { href: "/products", label: "ຂໍ້ມູນສິນຄ້າ", icon: BoxIcon, adminOnly: false },
  { href: "/samsung-sn", label: "SN SAMSUNG", icon: BoxIcon, adminOnly: false },
  { href: "/analytics", label: "ວິເຄາະຂາຍ", icon: ChartIcon, adminOnly: false },
  { href: "/stock-health", label: "ສຸຂະພາບ Stock", icon: PulseIcon, adminOnly: false },
  { href: "/abc-analysis", label: "ວິເຄາະ ABC", icon: LayersIcon, adminOnly: false },
  { href: "/quality", label: "ຄຸນນະພາບຂໍ້ມູນ", icon: CheckIcon, adminOnly: false },
  { href: "/defects", label: "ຕຳໜິ", icon: AlertIcon, adminOnly: false },
  { href: "/procurement", label: "ຈັດຊື້", icon: CartIcon, adminOnly: false },
  { href: "/purchase-plan", label: "ແຜນການສັ່ງຊື້", icon: ClipboardIcon, adminOnly: true },
  { href: "/kpi", label: "ຜົນງານທີມ", icon: ChartIcon, adminOnly: true },
  { href: "/staff", label: "ຈັດການພະນັກງານ", icon: UsersIcon, adminOnly: true },
  { href: "/spare-import", label: "ນຳເຂົ້າອາໄຫຼ່", icon: ImportIcon, adminOnly: true },
  { href: "/audit", label: "ບັນທຶກກິດຈະກຳ", icon: ClockIcon, adminOnly: true },
];

function CartIcon({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>);
}
function ChartIcon({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 14l3-4 4 3 5-7" /></svg>);
}
function PulseIcon({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l2 6 4-14 2 8h6" /></svg>);
}
function CheckIcon({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>);
}
function AlertIcon({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></svg>);
}

function ImportIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function LayersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  );
}

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export default function Sidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const visibleNav = NAV.filter(
    (item) =>
      (!item.adminOnly || isAdmin) &&
      item.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <aside className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/10 bg-[#050a1a]/95 px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(2,6,23,0.18)] backdrop-blur-xl md:sticky md:top-0 md:h-screen md:w-[244px] md:shrink-0 md:self-start md:flex-col md:border-r md:border-t-0 md:border-[#182036] md:px-0 md:py-0 md:shadow-none">
      <div className="hidden h-[68px] items-center justify-between border-b border-[#182036] px-4 md:flex">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-500 text-sm font-black text-white shadow-lg shadow-teal-950/30">OD</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-wide text-white">ODIEN GROUP</p>
            <p className="text-[10px] text-slate-500">PRODUCT MANAGEMENT</p>
          </div>
        </div>
        <span className="grid h-6 w-6 place-items-center rounded border border-slate-700 text-[10px] text-slate-500">‹</span>
      </div>

      <div className="hidden px-4 pt-5 md:block">
        <label className="flex h-10 items-center gap-2 rounded-xl border border-[#20283d] bg-[#0d1325] px-3 text-xs text-slate-500 focus-within:border-teal-500/70">
          <span className="text-base" aria-hidden="true">⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ຄົ້ນຫາເມນູ..." className="min-w-0 flex-1 bg-transparent text-xs text-slate-300 outline-none placeholder:text-slate-600" />
        </label>
        <p className="mb-2 mt-5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">ລະບົບຈັດການ</p>
      </div>

      <nav aria-label="ເມນູຫຼັກ" className="flex w-full gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex-1 md:flex-col md:overflow-y-auto md:px-3">
        {visibleNav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex min-h-11 min-w-[82px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-medium transition md:min-w-0 md:flex-row md:justify-start md:gap-2 md:px-3 md:py-2 md:text-[13px] ${
                active
                  ? "bg-teal-500/10 text-teal-300 ring-1 ring-inset ring-teal-400/70"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {active && <span className="absolute bottom-2 left-0 top-2 hidden w-0.5 rounded-full bg-teal-400 md:block" />}
              <Icon className="h-[18px] w-[18px]" />
              {label}
              {href === "/products" && (
                <span className="ml-auto hidden rounded-md bg-white/5 px-1.5 py-0.5 text-[9px] text-slate-500 md:inline">ALL</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mx-4 mb-4 hidden border-t border-[#182036] pt-4 md:block">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-500/15 text-xs font-bold text-teal-300">PC</span>
          <div>
            <p className="text-xs font-semibold text-slate-300">Product Center</p>
            <p className="text-[10px] text-slate-600">Internal workspace</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function BoxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 8 12 3 3 8v8l9 5 9-5z" />
      <path d="m3 8 9 5 9-5M12 13v8" />
    </svg>
  );
}
