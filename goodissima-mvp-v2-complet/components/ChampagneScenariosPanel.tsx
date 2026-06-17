"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ScenarioState = "not_started" | "in_progress" | "completed" | "failed";

type ChampagneScenario = {
  id: string;
  title: string;
  objective: string;
  value: string;
  steps: string[];
  href: string;
  routeLabel: string;
  future?: boolean;
};

export const champagneScenarioStorageKey = "goodissima.champagne.scenarios.v1";

export const champagneScenarioCount = 6;

const scenarios: ChampagneScenario[] = [
  {
    id: "recrutement-intelligent",
    title: "Recrutement intelligent",
    objective: "Créer une opportunité assistée par IA, structurer le parcours candidat et préparer une relation gouvernée.",
    value: "Démontre la création d'opportunité augmentée, le parcours candidat et la mesure de valeur IA.",
    steps: [
      "Ouvrir la création d'opportunité.",
      "Utiliser l'assistance IA pour cadrer le besoin avec des données fictives certifiées.",
      "Créer ou sélectionner un parcours, puis revenir au dashboard pour suivre la relation.",
    ],
    href: "/opportunities/new?scenario=champagne-recrutement-intelligent",
    routeLabel: "Création d'opportunité",
  },
  {
    id: "prospection-inversee",
    title: "Prospection inversée",
    objective: "Partir d'un besoin ou profil fictif certifié et tester la recherche de relations pertinentes depuis l'espace produit.",
    value: "Démontre la prospection inversée, le passage opportunité vers relations et le pilotage sans contact automatique.",
    steps: [
      "Créer une opportunité de prospection inversée.",
      "Qualifier le besoin sans publier automatiquement.",
      "Consulter les relations et propositions pertinentes.",
    ],
    href: "/opportunities/new?scenario=champagne-prospection-inversee",
    routeLabel: "Opportunités",
  },
  {
    id: "dossier-complexe-multi-acteurs",
    title: "Dossier complexe multi-acteurs",
    objective: "Orchestrer un dossier avec plusieurs parties, documents, actions et signaux de suivi.",
    value: "Démontre le workspace relationnel, les actions, l'assistance IA et la gouvernance humaine.",
    steps: [
      "Ouvrir l'espace Relations.",
      "Sélectionner ou créer un dossier fictif certifié.",
      "Tester actions, documents, messages internes et signaux IA sans notification réelle.",
    ],
    href: "/relations?scenario=champagne-dossier-complexe-multi-acteurs",
    routeLabel: "Relations",
  },
  {
    id: "qr-lien-securise",
    title: "QR Code / lien sécurisé",
    objective: "Valider la génération d'un lien sécurisé et son parcours candidat associé.",
    value: "Démontre le flux QR code, lien sécurisé, accès candidat et réponse sans publication automatique.",
    steps: [
      "Créer une opportunité ou ouvrir une opportunité existante.",
      "Vérifier le lien sécurisé et le QR code.",
      "Tester le formulaire candidat avec des données fictives certifiées.",
    ],
    href: "/opportunities?scenario=champagne-qr-lien-securise",
    routeLabel: "Opportunités",
  },
  {
    id: "multi-matching",
    title: "Multi-matching",
    objective: "Comparer plusieurs propositions et relations candidates dans le workspace normal.",
    value: "Démontre le matching multi-propositions, les arbitrages humains et la valeur opérationnelle.",
    steps: [
      "Ouvrir les relations.",
      "Identifier un dossier avec matching activé ou créer un cas de test fictif.",
      "Comparer les propositions, puis mesurer la valeur depuis IA & Valeur.",
    ],
    href: "/relations?scenario=champagne-multi-matching",
    routeLabel: "Relations",
  },
  {
    id: "cercle-hashtag",
    title: "Cercle / hashtag",
    objective: "Préfigurer des cercles de confiance et hashtags relationnels autour des parcours.",
    value: "Vision future pour explorer l'organisation collective sans modifier les règles Trust.",
    steps: [
      "Ouvrir les parcours existants.",
      "Identifier les endroits où cercle, hashtag ou communauté pourraient enrichir le suivi.",
      "Noter les hypothèses produit sans automatiser de décision.",
    ],
    href: "/parcours?scenario=champagne-cercle-hashtag",
    routeLabel: "Parcours",
    future: true,
  },
];

function readStoredState(): Record<string, ScenarioState> {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(champagneScenarioStorageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, ScenarioState] =>
        ["not_started", "in_progress", "completed", "failed"].includes(String(entry[1])),
      ),
    );
  } catch {
    return {};
  }
}

function statusLabel(state: ScenarioState) {
  if (state === "completed") return "terminé";
  if (state === "in_progress") return "à tester";
  if (state === "failed") return "à tester";

  return "prêt";
}

function statusClasses(state: ScenarioState) {
  if (state === "completed") return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (state === "failed") return "bg-red-50 text-red-800 ring-red-200";
  if (state === "in_progress") return "bg-amber-50 text-amber-800 ring-amber-200";

  return "bg-cyan-50 text-cyan-800 ring-cyan-200";
}

export function ChampagneScenariosPanel() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [states, setStates] = useState<Record<string, ScenarioState>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setStates(readStoredState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(champagneScenarioStorageKey, JSON.stringify(states));
  }, [hydrated, states]);

  const completedCount = useMemo(
    () => scenarios.filter((scenario) => states[scenario.id] === "completed").length,
    [states],
  );

  function setScenarioState(id: string, state: ScenarioState) {
    setStates((current) => ({ ...current, [id]: state }));
  }

  function resetScenarioState(id: string) {
    setStates((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  return (
    <section className="mb-8 rounded-3xl border border-amber-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full flex-col gap-3 p-5 text-left sm:flex-row sm:items-center sm:justify-between"
        aria-expanded={open}
      >
        <span>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
            Scénarios de validation Goodissima
          </span>
          <span className="mt-1 block text-xl font-bold text-slate-950">Tests Champagne</span>
          <span className="mt-1 block text-sm text-slate-500">
            Données fictives certifiées pour test. Aucune notification réelle, aucun contact, message externe, publication ou décision automatique.
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {completedCount}/{scenarios.length} terminés
          </span>
          <span className="rounded-full border px-3 py-1 text-xs font-semibold text-slate-700">
            {open ? "Masquer" : "Afficher"}
          </span>
        </span>
      </button>

      {open ? (
        <div className="border-t border-amber-100 p-5">
          <div className="mb-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950">
            Ces scénarios restent dans le produit réel : opportunités, parcours, relations, lien sécurisé et IA & Valeur.
            Les actions sensibles restent soumises à validation humaine explicite.
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {scenarios.map((scenario) => {
              const state = states[scenario.id] ?? "not_started";
              const isExpanded = expanded === scenario.id;

              return (
                <article key={scenario.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-950">{scenario.title}</h3>
                        {scenario.future ? (
                          <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-800 ring-1 ring-violet-200">
                            Vision future
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{scenario.objective}</p>
                    </div>
                    <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusClasses(state)}`}>
                      {statusLabel(state)}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Valeur démontrée</p>
                      <p className="mt-1 text-slate-700">{scenario.value}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Route produit</p>
                      <p className="mt-1 text-slate-700">{scenario.routeLabel}</p>
                    </div>
                  </div>

                  {isExpanded ? (
                    <ol className="mt-4 space-y-2 rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
                      {scenario.steps.map((step, index) => (
                        <li key={step}>
                          {index + 1}. {step}
                        </li>
                      ))}
                    </ol>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={scenario.href}
                      onClick={() => setScenarioState(scenario.id, "in_progress")}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                    >
                      Lancer le scénario
                    </Link>
                    <button
                      type="button"
                      onClick={() => setExpanded(isExpanded ? null : scenario.id)}
                      className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700"
                    >
                      Voir les étapes
                    </button>
                    <Link
                      href={`/ia-valeur?scenario=${scenario.id}`}
                      className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-900"
                    >
                      Mesurer la valeur
                    </Link>
                    <button
                      type="button"
                      onClick={() => resetScenarioState(scenario.id)}
                      className="rounded-xl border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-800"
                    >
                      Réinitialiser les données de test
                    </button>
                    <button
                      type="button"
                      onClick={() => setScenarioState(scenario.id, "completed")}
                      className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900"
                    >
                      Marquer comme testé
                    </button>
                    <button
                      type="button"
                      onClick={() => setScenarioState(scenario.id, "failed")}
                      className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-900"
                    >
                      Signaler un échec
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
