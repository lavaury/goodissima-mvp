import Link from "next/link";

export function DirectoryTabs({ activeTab }: { activeTab: "global" | "moi" }) {
  return (
    <nav aria-label="Sections de l’Annuaire" className="mb-6 rounded-2xl border bg-white p-2 shadow-sm">
      <div role="tablist" aria-label="Annuaire Global ou Moi" className="grid grid-cols-2 gap-2">
        <Link
          href="/annuaire?tab=global"
          role="tab"
          aria-selected={activeTab === "global"}
          className={activeTab === "global" ? "rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white" : "rounded-xl px-4 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"}
        >
          Global
        </Link>
        <Link
          href="/annuaire?tab=moi"
          role="tab"
          aria-selected={activeTab === "moi"}
          className={activeTab === "moi" ? "rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white" : "rounded-xl px-4 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"}
        >
          Moi
        </Link>
      </div>
    </nav>
  );
}
