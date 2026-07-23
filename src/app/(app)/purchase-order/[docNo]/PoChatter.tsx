"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  addPoActivity,
  addPoComment,
  deletePoComment,
  togglePoActivity,
  toggleFollow,
  type ChatterState,
} from "../chatter-actions";
import type { PoActivity, PoComment, PoFollower } from "@/lib/purchase-order";
import type { DeptStaff } from "@/lib/products";

const initial: ChatterState = { error: null, success: null };

function fmtDT(v: string | null) {
  if (!v) return "";
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  return m ? `${m[3]}/${m[2]} ${m[4]}:${m[5]}` : v;
}
function fmtD(v: string | null) {
  if (!v) return "-";
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : v;
}
function initials(name: string) {
  return (name.trim()[0] ?? "?").toUpperCase();
}

function Btn({ idle, tone = "teal" }: { idle: string; tone?: "teal" | "slate" }) {
  const { pending } = useFormStatus();
  const cls = tone === "teal" ? "bg-teal-600 hover:bg-teal-500" : "bg-slate-600 hover:bg-slate-500";
  return <button type="submit" disabled={pending} className={`rounded-md px-4 py-1.5 text-xs font-bold text-white transition disabled:opacity-60 ${cls}`}>{pending ? "..." : idle}</button>;
}

export default function PoChatter({
  docNo,
  comments,
  activities,
  followers,
  staff,
  currentUserCode,
  isFollowing,
}: {
  docNo: string;
  comments: PoComment[];
  activities: PoActivity[];
  followers: PoFollower[];
  staff: DeptStaff[];
  currentUserCode: string;
  isFollowing: boolean;
}) {
  const [, commentAction] = useActionState(addPoComment, initial);
  const [, delAction] = useActionState(deletePoComment, initial);
  const [actState, activityAction] = useActionState(addPoActivity, initial);
  const [, toggleAct] = useActionState(togglePoActivity, initial);
  const [, followAction] = useActionState(toggleFollow, initial);
  const openCount = activities.filter((a) => a.status !== "done").length;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {/* follower bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
        <form action={followAction}>
          <input type="hidden" name="doc_no" value={docNo} />
          <button type="submit" className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition ${isFollowing ? "border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400" : "border-slate-300 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"}`}>
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill={isFollowing ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" /></svg>
            {isFollowing ? "ກຳລັງຕິດຕາມ" : "ຕິດຕາມ"}
          </button>
        </form>
        <div className="flex items-center gap-1">
          {followers.slice(0, 6).map((f) => (
            <span key={f.employee_code} title={f.name} className="grid h-7 w-7 place-items-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-600 ring-2 ring-white dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-900">{initials(f.name)}</span>
          ))}
          {followers.length > 6 && <span className="ml-1 text-[11px] text-slate-400">+{followers.length - 6}</span>}
          {followers.length === 0 && <span className="text-[11px] text-slate-400">ຍັງບໍ່ມີຜູ້ຕິດຕາມ</span>}
        </div>
      </div>

      {/* activities */}
      <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <h3 className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
          <svg className="h-4 w-4 text-teal-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
          ວຽກ / ຕິດຕາມ {openCount > 0 && <span className="rounded-full bg-amber-500 px-1.5 text-[10px] text-white">{openCount}</span>}
        </h3>
        <form action={activityAction} className="space-y-1.5">
          <input type="hidden" name="doc_no" value={docNo} />
          <input name="title" required placeholder="ຫົວຂໍ້ວຽກ (ເຊັ່ນ: ຕິດຕາມ supplier)" className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] text-slate-900 outline-none focus:border-teal-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
          <div className="flex flex-wrap gap-1.5">
            <select name="assignee" className="min-h-8 flex-1 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900 outline-none focus:border-teal-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
              <option value="">— ມອບໝາຍ (ບໍ່ບັງຄັບ) —</option>
              {staff.map((s) => <option key={s.employee_code} value={s.employee_code}>{s.fullname}</option>)}
            </select>
            <input type="date" name="due_date" className="min-h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900 outline-none focus:border-teal-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
            <Btn idle="ເພີ່ມ" tone="slate" />
          </div>
          {actState.error && <p className="text-[11px] text-red-600 dark:text-red-400">{actState.error}</p>}
        </form>
        <div className="mt-2 space-y-1.5">
          {activities.map((a) => {
            const done = a.status === "done";
            const overdue = !done && a.due_date && a.due_date < today;
            return (
              <div key={a.id} className="flex items-start gap-2">
                <form action={toggleAct} className="pt-0.5">
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="doc_no" value={docNo} />
                  <button type="submit" aria-label="toggle" className={`grid h-4 w-4 place-items-center rounded border text-[10px] ${done ? "border-teal-500 bg-teal-500 text-white" : "border-slate-300 text-transparent hover:border-teal-400 dark:border-slate-600"}`}>✓</button>
                </form>
                <div className="min-w-0 flex-1">
                  <p className={`text-[13px] ${done ? "text-slate-400 line-through" : "text-slate-800 dark:text-slate-200"}`}>{a.title}</p>
                  <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
                    {a.assignee_name && <span>👤 {a.assignee_name}</span>}
                    {a.due_date && <span className={overdue ? "font-semibold text-red-500" : ""}>📅 {fmtD(a.due_date)}{overdue ? " (ເກີນກຳນົດ)" : ""}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* message composer */}
      <div className="px-4 py-3">
        <form action={commentAction} className="flex flex-col gap-2">
          <input type="hidden" name="doc_no" value={docNo} />
          <textarea name="body" rows={2} required placeholder="ສົ່ງຂໍ້ຄວາມ..." className="w-full rounded-md border border-slate-200 bg-white p-2.5 text-[13px] text-slate-900 outline-none transition focus:border-teal-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
          <div className="flex justify-end"><Btn idle="ສົ່ງ" /></div>
        </form>

        {/* feed */}
        <div className="mt-3 space-y-3">
          {comments.length === 0 && <p className="py-2 text-center text-xs text-slate-400">ຍັງບໍ່ມີການເຄື່ອນໄຫວ</p>}
          {comments.map((c) =>
            c.kind === "log" ? (
              <div key={c.id} className="flex items-center gap-2 text-[11px] text-slate-400">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-slate-100 text-[9px] dark:bg-slate-800">⚙</span>
                <span className="italic">{c.author} · {c.body}</span>
                <span className="ml-auto shrink-0">{fmtDT(c.created_at)}</span>
              </div>
            ) : (
              <div key={c.id} className="flex gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal-100 text-xs font-bold text-teal-700 dark:bg-teal-500/15 dark:text-teal-400">{initials(c.author)}</span>
                <div className="min-w-0 flex-1 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/40">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{c.author}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400">{fmtDT(c.created_at)}</span>
                      {c.author_code === currentUserCode && (
                        <form action={delAction} className="inline">
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="doc_no" value={docNo} />
                          <button type="submit" aria-label="ລຶບ" className="text-slate-300 hover:text-red-600">✕</button>
                        </form>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-[13px] text-slate-700 dark:text-slate-200">{c.body}</p>
                </div>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
