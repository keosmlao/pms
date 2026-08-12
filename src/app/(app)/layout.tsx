import { Suspense } from "react";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import TopLoader from "@/components/TopLoader";
import { logout } from "@/lib/auth-actions";
import { getUserScope } from "@/lib/loyalty";
import { getIsAdmin } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [isAdmin, scope] = await Promise.all([
    getIsAdmin(user.employeeCode),
    getUserScope(user.employeeCode),
  ]);

  return (
    <div className="flex min-h-screen">
      <Suspense fallback={null}>
        <TopLoader />
      </Suspense>
      <Sidebar isAdmin={isAdmin} isResponsible={scope.isScoped} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass sticky top-0 z-30 flex h-[68px] items-center justify-between rounded-none border-x-0 border-t-0 px-4 sm:px-6 lg:px-7">
          <div className="flex items-center gap-3">
            <span className="hidden h-7 w-px bg-brand-navy/15 sm:block dark:bg-white/10" />
            <div>
              <p className="text-sm font-bold text-brand-navy dark:text-slate-100">ລະບົບຈັດການສິນຄ້າ</p>
              <p className="text-[10px] text-slate-400">Product Management Center</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" aria-label="ການແຈ້ງເຕືອນ" className="relative hidden h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-brand-blue/10 hover:text-brand-blue sm:grid">
              <span aria-hidden="true">◌</span>
            </button>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{user.fullname}</p>
              <p className="font-mono text-[10px] text-slate-400">{user.employeeCode}</p>
            </div>
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-brand-blue to-brand-navy text-sm font-bold text-white shadow-sm shadow-brand-navy/30" aria-hidden="true">
              {user.fullname.trim().charAt(0) || "O"}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-lg border border-brand-navy/15 bg-white/70 px-3 py-2 text-xs font-medium text-slate-500 transition hover:border-brand-blue/40 hover:bg-brand-blue/10 hover:text-brand-blue dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
              >
                ອອກ
              </button>
            </form>
          </div>
        </header>
        <main className="min-w-0 flex-1 px-4 pb-28 pt-5 sm:px-6 md:pb-8 lg:px-7 lg:py-6">{children}</main>
      </div>
    </div>
  );
}
