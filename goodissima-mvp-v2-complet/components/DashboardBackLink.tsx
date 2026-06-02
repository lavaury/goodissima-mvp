import Link from "next/link";

export function DashboardBackLink({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/dashboard"
      prefetch={false}
      className={`inline-flex min-h-10 items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-950 ${className}`}
    >
      ← Retour au Dashboard
    </Link>
  );
}
