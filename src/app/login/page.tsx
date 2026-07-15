"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { login, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-teal-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-teal-950/20 transition hover:bg-teal-500 disabled:opacity-60"
    >
      {pending ? "ກຳລັງເຂົ້າສູ່ລະບົບ..." : "ເຂົ້າສູ່ລະບົບ"}
    </button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useActionState(login, initialState);

  return (
    <main className="grid min-h-screen bg-slate-950 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -left-32 top-1/3 h-96 w-96 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="absolute -right-32 -top-24 h-80 w-80 rounded-full border-[64px] border-white/[0.03]" />
        <div className="relative flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-teal-500 font-black shadow-xl shadow-teal-950/20">OD</span>
          <div><p className="font-bold">ODIEN GROUP</p><p className="text-xs tracking-[0.18em] text-slate-400">PRODUCT CENTER</p></div>
        </div>
        <div className="relative max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-400">One source of product truth</p>
          <h1 className="mt-4 text-5xl font-bold leading-[1.15] tracking-tight">ຂໍ້ມູນສິນຄ້າ<br />ທີ່ພ້ອມໃຫ້ທຸກຄົນ</h1>
          <p className="mt-5 max-w-md text-base leading-8 text-slate-300">ຄົ້ນຫາສິນຄ້າ, ກວດລາຄາ, stock ແລະ ປະຫວັດເຄື່ອນໄຫວໄດ້ໃນບ່ອນດຽວ</p>
        </div>
        <p className="relative text-xs text-slate-500">© ODIEN GROUP · Internal workspace</p>
      </section>
      <section className="flex items-center justify-center bg-[#f6f7f9] p-5 sm:p-10 dark:bg-slate-900">
      <div className="w-full max-w-md rounded-xl border border-white bg-white p-7 shadow-2xl shadow-slate-950/10 sm:p-10 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center gap-3 lg:hidden">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-500 text-sm font-black text-white">OD</span>
          <p className="font-bold text-slate-950 dark:text-white">ODIEN GROUP</p>
        </div>
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-teal-600 lg:mt-0">Welcome back</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">ເຂົ້າສູ່ລະບົບ</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">ໃຊ້ບັນຊີພະນັກງານເພື່ອເຂົ້າ Product Center</p>

        <form action={formAction} className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="employee_code"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              ລະຫັດພະນັກງານ
            </label>
            <input
              id="employee_code"
              name="employee_code"
              autoComplete="username"
              autoFocus
              required
              placeholder="ເຊັ່ນ: OD001"
              className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:bg-white dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              ລະຫັດຜ່ານ
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:bg-white dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
          </div>

          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {state.error}
            </p>
          )}

          <SubmitButton />
        </form>
      </div>
      </section>
    </main>
  );
}
