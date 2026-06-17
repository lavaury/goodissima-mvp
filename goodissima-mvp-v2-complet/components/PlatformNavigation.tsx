"use client";

import Link from "next/link";
import { ActiveOrganizationBadge } from "@/components/ActiveOrganizationBadge";

const items = [
  { label: "Dashboard", href: "/dashboard" },
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
  active: "dashboard" | "opportunities" | "relations" | "studio" | "analytics" | "admin" | "trust" | "identity" | "settings";
  organizationName?: string | null;
}) {
  const activeHref =
    active === "dashboard"
      ? "/dashboard"
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

  return (
    <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <nav className="flex gap-2 overflow-x-auto rounded-2xl border bg-white p-2 pr-28 shadow-sm sm:pr-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={
              item.href === activeHref
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
