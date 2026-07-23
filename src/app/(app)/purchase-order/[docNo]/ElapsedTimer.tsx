"use client";

import { useEffect, useState } from "react";

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d > 0 ? `${d} ວ ` : ""}${pad(h)}:${pad(m)}:${pad(sec)}`;
}

// Live elapsed timer from startMs; freezes at endMs once set (fully received).
export default function ElapsedTimer({ startMs, endMs }: { startMs: number; endMs: number | null }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endMs) return; // stopped — no ticking
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [endMs]);

  const elapsed = (endMs ?? now) - startMs;
  const done = endMs != null;

  return (
    <span
      suppressHydrationWarning
      className={`inline-flex items-center gap-1.5 font-mono text-lg font-bold tabular-nums ${done ? "text-green-600 dark:text-green-400" : "text-teal-600 dark:text-teal-400"}`}
    >
      {!done && <span className="h-2 w-2 animate-pulse rounded-full bg-teal-500" />}
      {fmt(elapsed)}
    </span>
  );
}
