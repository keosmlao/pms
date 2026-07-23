"use client";

import { useRouter } from "next/navigation";

export default function DeptSelect({
  departments,
  value,
  q,
  status,
  view,
}: {
  departments: { code: string; name: string }[];
  value: string;
  q: string;
  status: string;
  view: string;
}) {
  const router = useRouter();
  return (
    <select
      value={value}
      onChange={(e) => {
        const p = new URLSearchParams();
        if (q) p.set("q", q);
        if (status && status !== "all") p.set("status", status);
        if (view && view !== "all") p.set("view", view);
        if (e.target.value) p.set("dept", e.target.value);
        router.push(`/purchase-order${p.toString() ? `?${p}` : ""}`);
      }}
      className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-teal-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
    >
      <option value="">— ທຸກພະແນກ —</option>
      {departments.map((d) => (
        <option key={d.code} value={d.code}>
          {d.code} · {d.name}
        </option>
      ))}
    </select>
  );
}
