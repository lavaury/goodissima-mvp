export default function SettingsLoading() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="h-9 w-64 animate-pulse rounded-xl bg-slate-200" />
      <div className="mt-3 h-5 w-96 max-w-full animate-pulse rounded-lg bg-slate-100" />
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
            <div className="mt-5 space-y-4">
              {Array.from({ length: 4 }).map((__, itemIndex) => (
                <div key={itemIndex} className="h-12 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
