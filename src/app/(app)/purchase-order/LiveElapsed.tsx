"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// One shared 1s clock for the whole list — avoids 150 separate intervals.
const NowCtx = createContext<number>(0);

export function LiveClock({ children }: { children: ReactNode }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return <NowCtx.Provider value={now}>{children}</NowCtx.Provider>;
}

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d > 0 ? `${d}ວ ` : ""}${pad(h)}:${pad(m)}:${pad(sec)}`;
}

// Elapsed since startMs; ticks live while endMs is null, freezes green once endMs is set (fully received).
export function ElapsedCell({ startMs, endMs }: { startMs: number | null; endMs: number | null }) {
  const ctxNow = useContext(NowCtx);
  if (!startMs) return <span className="text-slate-300 dark:text-slate-600">—</span>;

  const now = ctxNow || startMs;
  const done = endMs != null;
  const elapsed = (endMs ?? now) - startMs;

  return (
    <span
      suppressHydrationWarning
      className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-bold tabular-nums ${
        done ? "text-green-600 dark:text-green-400" : "text-teal-600 dark:text-teal-400"
      }`}
    >
      {!done && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-500" />}
      {fmt(elapsed)}
    </span>
  );
}
