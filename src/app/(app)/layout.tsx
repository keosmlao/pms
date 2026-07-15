import { Suspense } from "react";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import TopLoader from "@/components/TopLoader";
import { logout } from "@/lib/auth-actions";
import { getIsAdmin } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const isAdmin = await getIsAdmin(user.employeeCode);

  return (
    <div className="flex min-h-screen bg-[#f5f7fb] dark:bg-slate-950">
      <Suspense fallback={null}>
        <TopLoader />
      </Suspense>
      <Sidebar isAdmin={isAdmin} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90 sm:px-6 lg:px-7">
          <div className="flex items-center gap-3">
            <span className="hidden h-7 w-px bg-slate-200 sm:block" />
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">ລະບົບຈັດການສິນຄ້າ</p>
              <p className="text-[10px] text-slate-400">Product Management Center</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" aria-label="ການແຈ້ງເຕືອນ" className="relative hidden h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 sm:grid">
              <span aria-hidden="true">◌</span>
            </button>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{user.fullname}</p>
              <p className="font-mono text-[10px] text-slate-400">{user.employeeCode}</p>
            </div>
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-teal-600 text-sm font-bold text-white shadow-sm" aria-hidden="true">
              {user.fullname.trim().charAt(0) || "O"}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-500 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
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
