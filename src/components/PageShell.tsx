import type { ReactNode } from "react";

export function PageShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`w-full ${className}`}>{children}</div>;
}

export function PageHeader({
  section,
  title,
  description,
  action,
}: {
  section: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span>ໜ້າຫຼັກ</span>
          <span aria-hidden="true">/</span>
          <span className="truncate font-medium text-slate-600 dark:text-slate-300">{section}</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-xs text-slate-500 dark:text-slate-400">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function MetricCard({
  label,
  value,
  note,
  valueClassName = "text-slate-950 dark:text-white",
}: {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="glass rounded-xl p-4">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold tracking-tight ${valueClassName}`}>{value}</p>
      {note ? <p className="mt-1 text-[10px] text-slate-400">{note}</p> : null}
    </div>
  );
}
