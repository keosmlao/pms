"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function TopLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = () => {
    if (tick.current) return;
    if (hide.current) clearTimeout(hide.current);
    setVisible(true);
    setWidth(8);
    tick.current = setInterval(() => {
      setWidth((w) => (w < 90 ? w + (90 - w) * 0.12 : w));
    }, 200);
  };

  const done = () => {
    if (!tick.current) return;
    clearInterval(tick.current);
    tick.current = null;
    setWidth(100);
    hide.current = setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 250);
  };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname && url.search === window.location.search) return;
        start();
      } catch {
        /* ignore malformed href */
      }
    };
    document.addEventListener("click", onClick, true);

    // router.push (e.g. the warehouse filter) navigates via pushState.
    const original = history.pushState;
    history.pushState = function (...args) {
      start();
      return original.apply(this, args as Parameters<typeof original>);
    };

    return () => {
      document.removeEventListener("click", onClick, true);
      history.pushState = original;
    };
  }, []);

  // Navigation committed → finish the bar.
  useEffect(() => {
    done();
  }, [pathname, searchParams]);

  if (!visible) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5">
      <div
        className="h-full bg-teal-500 shadow-[0_0_10px_1px] shadow-teal-500/60 transition-[width,opacity] duration-200 ease-out"
        style={{ width: `${width}%`, opacity: width >= 100 ? 0 : 1 }}
      />
    </div>
  );
}
