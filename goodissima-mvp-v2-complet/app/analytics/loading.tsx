export default function AnalyticsLoading() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="h-9 w-56 animate-pulse rounded-xl bg-slate-200" />
      <div className="mt-3 h-5 w-96 max-w-full animate-pulse rounded-lg bg-slate-100" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="h-4 w-28 animate-pulse rounded bg-slate-100" />
            <div className="mt-4 h-8 w-16 animate-pulse rounded bg-slate-200" />
            <div className="mt-3 h-3 w-full animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </main>
  );
}
