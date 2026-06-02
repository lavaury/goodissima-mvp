"use client";

import Link from "next/link";
import { ActiveOrganizationBadge } from "@/components/ActiveOrganizationBadge";
import { useI18n } from "@/components/I18nProvider";

const items = [
  { labelKey: "nav.relations", href: "/dashboard" },
  { labelKey: "nav.studio", href: "/templates" },
  { labelKey: "nav.analytics", href: "/analytics" },
  { labelKey: "nav.settings", href: "/settings" },
];

export function PlatformNavigation({
  active,
  organizationName,
}: {
  active: "relations" | "studio" | "analytics" | "settings";
  organizationName?: string | null;
}) {
  const { t } = useI18n();
  const activeHref =
    active === "relations"
      ? "/dashboard"
      : active === "studio"
        ? "/templates"
        : active === "analytics"
          ? "/analytics"
          : "/settings";

  return (
    <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <nav className="flex gap-2 overflow-x-auto rounded-2xl border bg-white p-2 pr-28 shadow-sm sm:pr-2">
        {items.map((item) => (
          <Link
            key={item.labelKey}
            href={item.href}
            className={
              item.href === activeHref
                ? "whitespace-nowrap rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                : "whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            }
          >
            {t(item.labelKey)}
          </Link>
        ))}
      </nav>
      <ActiveOrganizationBadge organizationName={organizationName} />
    </div>
  );
}
