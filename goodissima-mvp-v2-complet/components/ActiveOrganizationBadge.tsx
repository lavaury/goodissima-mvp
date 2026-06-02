export function ActiveOrganizationBadge({
  organizationName,
  className = "",
}: {
  organizationName?: string | null;
  className?: string;
}) {
  if (!organizationName) return null;

  return (
    <div className={`flex min-w-0 items-center gap-3 rounded-2xl border bg-white px-4 py-2 shadow-sm ${className}`}>
      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Espace actif</p>
        <p className="truncate text-sm font-semibold text-slate-900">{organizationName}</p>
      </div>
    </div>
  );
}
