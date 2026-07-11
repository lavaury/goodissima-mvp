"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ActiveOrganizationBadge } from "@/components/ActiveOrganizationBadge";

const items = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Gouvernance", href: "/gouvernance" },
  { label: "Salle de pilotage", href: "/gouvernance/pilotage" },
  { label: "Portfolios", href: "/gouvernance/portfolios" },
  { label: "Nouveau parcours", href: "/gouvernance/nouveau" },
  { label: "Annuaire", href: "/annuaire" },
  { label: "Identite", href: "/identity" },
  { label: "Confiance", href: "/trust/connectors" },
  { label: "Parametres", href: "/settings" },
  { label: "Opportunités", href: "/opportunities" },
  { label: "Parcours", href: "/parcours", legacyHref: "/templates" },
  { label: "Relations", href: "/relations" },
  { label: "IA & Valeur", href: "/ia-valeur" },
  { label: "Administration", href: "/administration" },
];

export function PlatformNavigation({
  active,
  organizationName,
}: {
  active:
    | "dashboard"
    | "governance"
    | "new-governance"
    | "directory"
    | "opportunities"
    | "relations"
    | "studio"
    | "analytics"
    | "admin"
    | "trust"
    | "identity"
    | "settings";
  organizationName?: string | null;
}) {
  const pathname = usePathname();
  const activeHref =
    active === "dashboard"
      ? "/dashboard"
      : active === "governance"
      ? "/gouvernance"
      : active === "new-governance"
      ? "/gouvernance/nouveau"
      : active === "directory"
      ? "/annuaire"
      : active === "opportunities"
      ? "/opportunities"
      : active === "relations"
      ? "/relations"
      : active === "studio"
        ? "/parcours"
        : active === "analytics"
          ? "/ia-valeur"
          : active === "admin"
          ? "/administration"
          : active === "trust"
            ? "/trust/connectors"
            : active === "identity"
              ? "/identity"
              : "/settings";
  const resolvedActiveHref = pathname === "/gouvernance" || pathname.startsWith("/gouvernance/parcours/")
    ? "/gouvernance"
    : pathname === "/gouvernance/pilotage" || pathname.startsWith("/gouvernance/pilotage/")
      ? "/gouvernance/pilotage"
      : pathname === "/gouvernance/portfolios" || pathname.startsWith("/gouvernance/portfolios/")
        ? "/gouvernance/portfolios"
        : pathname === "/gouvernance/nouveau"
          ? "/gouvernance/nouveau"
          : activeHref;

  return (
    <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <nav className="flex gap-2 overflow-x-auto rounded-2xl border bg-white p-2 pr-28 shadow-sm sm:pr-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={
              item.href === resolvedActiveHref
                ? "whitespace-nowrap rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                : "whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            }
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <ActiveOrganizationBadge organizationName={organizationName} />
    </div>
  );
}
