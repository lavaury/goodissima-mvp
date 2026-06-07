"use client";

import { useMemo, useState } from "react";
import { LinkCard } from "@/components/LinkCard";
import type { LinkAdmissionMode } from "@/components/LinkAdmissionPanel";

type DashboardLink = {
  id: string;
  slug: string;
  title: string;
  city?: string | null;
  templateName?: string | null;
  templateStatus?: string | null;
  templateVersion?: number | null;
  isTrustAdmissionPilot?: boolean;
  admissionMode?: LinkAdmissionMode;
  openActionCount?: number;
  cases?: Array<{
    id: string;
    candidateEmail: string;
    priority: string;
    status: string;
    lastActivityAt?: number;
  }>;
};

const filters = [
  { value: "ALL", label: "Tous" },
  { value: "ACTIVE", label: "Actifs" },
  { value: "WAITING", label: "En attente" },
  { value: "HIGH", label: "Prioritaires" },
  { value: "URGENT", label: "Urgents" },
  { value: "CLOSED", label: "Clotures" },
  { value: "ARCHIVED", label: "Archives" },
];

function hasActiveCase(item: DashboardLink) {
  return (
    item.cases?.some(
      (relationCase) =>
        relationCase.status !== "CLOSED" && relationCase.status !== "ARCHIVED",
    ) ?? false
  );
}

function matchesFilter(item: DashboardLink, filter: string) {
  if (filter === "ACTIVE") return hasActiveCase(item);
  if (filter === "WAITING") return !hasActiveCase(item);
  if (filter === "HIGH") {
    return item.cases?.some((relationCase) => relationCase.priority === "HIGH") ?? false;
  }
  if (filter === "URGENT") {
    return item.cases?.some((relationCase) => relationCase.priority === "URGENT") ?? false;
  }
  if (filter === "CLOSED") {
    return item.cases?.some((relationCase) => relationCase.status === "CLOSED") ?? false;
  }
  if (filter === "ARCHIVED") {
    return item.cases?.some((relationCase) => relationCase.status === "ARCHIVED") ?? false;
  }

  return true;
}

function getCasesForFilter(item: DashboardLink, filter: string) {
  if (filter === "ACTIVE") {
    return item.cases?.filter(
      (relationCase) =>
        relationCase.status !== "CLOSED" && relationCase.status !== "ARCHIVED",
    );
  }
  if (filter === "CLOSED") {
    return item.cases?.filter((relationCase) => relationCase.status === "CLOSED");
  }
  if (filter === "ARCHIVED") {
    return item.cases?.filter((relationCase) => relationCase.status === "ARCHIVED");
  }

  return item.cases;
}

function matchesSearch(item: DashboardLink, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) return true;

  const searchableText = [
    item.title,
    item.city ?? "",
    item.slug,
    ...(item.cases?.map((relationCase) => relationCase.candidateEmail) ?? []),
  ]
    .join(" ")
    .toLowerCase();

  return searchableText.includes(normalizedQuery);
}

export function DashboardLinkFilters({
  links,
  debugMode = false,
  showAdmissionPanel = false,
}: {
  links: DashboardLink[];
  debugMode?: boolean;
  showAdmissionPanel?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");
  const filteredLinks = useMemo(
    () =>
      links
        .filter((item) => matchesSearch(item, query) && matchesFilter(item, filter))
        .map((item) => ({
          ...item,
          cases: getCasesForFilter(item, filter),
        })),
    [links, query, filter],
  );

  return (
    <section>
      <div className="mb-4 rounded-2xl border bg-white p-4 shadow-sm">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher un lien, une ville, un slug ou un email candidat"
          className="w-full rounded-xl border px-4 py-3 text-sm"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {filters.map((item) => {
            const selected = item.value === filter;

            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={
                  selected
                    ? "rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                    : "rounded-full border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                }
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {filteredLinks.length === 0 ? (
        <div className="rounded-2xl border bg-white p-8 text-center">
          <p className="text-slate-600">Aucun lien correspondant</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredLinks.map((item) => (
            <LinkCard
              key={item.id}
              item={item}
              debugMode={debugMode}
              showAdmissionPanel={showAdmissionPanel}
            />
          ))}
        </div>
      )}
    </section>
  );
}
