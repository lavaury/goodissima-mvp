"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { champagneScenarioCount, champagneScenarioStorageKey } from "@/components/ChampagneScenariosPanel";

type ScenarioState = "not_started" | "in_progress" | "completed" | "failed";

function readCompletedCount() {
  try {
    const raw = window.localStorage.getItem(champagneScenarioStorageKey);
    if (!raw) return 0;
    const states = JSON.parse(raw) as Record<string, ScenarioState>;

    return Math.min(
      champagneScenarioCount,
      Object.values(states).filter((state) => state === "completed").length,
    );
  } catch {
    return 0;
  }
}

export function ChampagneDashboardCard() {
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    setCompletedCount(readCompletedCount());

    function refreshProgress(event: StorageEvent) {
      if (event.key === champagneScenarioStorageKey) setCompletedCount(readCompletedCount());
    }

    window.addEventListener("storage", refreshProgress);
    return () => window.removeEventListener("storage", refreshProgress);
  }, []);

  const progressPercent = useMemo(
    () => Math.round((completedCount / champagneScenarioCount) * 100),
    [completedCount],
  );

  return (
    <section className="mb-8 rounded-3xl border border-amber-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Tests Champagne</p>
          <h2 className="mt-1 text-xl font-bold text-slate-950">Valider les grands scénarios Goodissima</h2>
          <p className="mt-2 text-sm text-slate-500">
            {completedCount} / {champagneScenarioCount} scénarios testés
          </p>
        </div>
        <div className="flex min-w-56 flex-col gap-3">
          <div className="h-2 overflow-hidden rounded-full bg-amber-100">
            <div className="h-full bg-amber-500" style={{ width: `${progressPercent}%` }} />
          </div>
          <Link
            href="/administration#tests-champagne"
            className="rounded-xl bg-slate-900 px-4 py-2 text-center text-sm font-semibold text-white"
          >
            Ouvrir les tests
          </Link>
        </div>
      </div>
    </section>
  );
}
