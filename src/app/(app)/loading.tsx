function Line({ className }: { className: string }) {
  return <div className={`rounded bg-slate-200 dark:bg-slate-800 ${className}`} />;
}

export default function AppLoading() {
  return (
    <div className="w-full animate-pulse" role="status" aria-busy="true" aria-label="ກຳລັງໂຫຼດຂໍ້ມູນ">
      <div className="space-y-2">
        <Line className="h-3 w-36" />
        <Line className="h-7 w-64 max-w-[70%]" />
        <Line className="h-3 w-96 max-w-full" />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-24 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <Line className="h-3 w-24" />
            <Line className="mt-4 h-6 w-32" />
          </div>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex h-14 items-center justify-between border-b border-slate-200 px-5 dark:border-slate-800">
          <Line className="h-4 w-40" />
          <Line className="h-8 w-24 rounded-lg" />
        </div>
        <div className="h-10 border-b border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/40" />
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="grid min-h-12 grid-cols-[100px_minmax(180px,1fr)_120px_90px] items-center gap-4 border-b border-slate-100 px-4 last:border-0 dark:border-slate-800">
            <Line className="h-3 w-20" />
            <Line className="h-3 w-3/4" />
            <Line className="h-3 w-20" />
            <Line className="h-3 w-14" />
          </div>
        ))}
      </div>

      <span className="sr-only">ກຳລັງໂຫຼດ...</span>
    </div>
  );
}
