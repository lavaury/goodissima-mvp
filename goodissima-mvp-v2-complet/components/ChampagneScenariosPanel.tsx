"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

type ScenarioState = "not_started" | "in_progress" | "completed" | "failed";

type ChampagneScenario = {
  id: string;
  title: string;
  objective: string;
  demonstration: string;
  prerequisites: string[];
  requiredData: string[];
  steps: string[];
  expectedResult: string;
  observation: string;
  successCriterion: string;
  failureAction: string;
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
    demonstration: "La création d'une annonce de recrutement cohérente, son parcours candidat, la validation humaine et la mesure de valeur IA.",
    prerequisites: ["Être connecté avec un rôle autorisé aux tests Champagne.", "Disposer d'un parcours de recrutement ou pouvoir en créer un."],
    requiredData: ["Intitulé de poste fictif.", "Compétences, expérience, disponibilité et budget fictifs.", "Aucune donnée personnelle réelle."],
    steps: [
      "Ouvrir la création d'opportunité.",
      "Utiliser l'assistance IA pour cadrer le besoin avec des données fictives certifiées.",
      "Relire puis valider humainement le parcours proposé.",
      "Vérifier l'annonce, puis revenir au dashboard pour suivre la relation.",
    ],
    expectedResult: "Une opportunité de recrutement est créée avec les champs métier adaptés et reste non publiée avant validation explicite.",
    observation: "L'utilisateur doit voir le poste, les compétences, l'expérience, la disponibilité, le budget et la modalité d'intervention, sans champ immobilier.",
    successCriterion: "Le domaine recrutement reste stable entre génération, validation et aperçu, et aucune action externe n'est déclenchée.",
    failureAction: "Noter le titre, le domaine affiché et les champs incorrects, puis signaler un échec sans publier l'annonce.",
    href: "/opportunities/new?scenario=champagne-recrutement-intelligent",
    routeLabel: "Création d'opportunité",
  },
  {
    id: "prospection-inversee",
    title: "Prospection inversée",
    objective: "Partir d'un besoin ou profil fictif certifié et tester la recherche de relations pertinentes depuis l'espace produit.",
    demonstration: "La prospection inversée, le passage d'une opportunité vers des relations pertinentes et le pilotage sans contact automatique.",
    prerequisites: ["Être connecté avec accès aux opportunités et relations.", "Disposer d'au moins un profil ou besoin fictif."],
    requiredData: ["Profil fictif certifié.", "Critères de recherche et préférences fictifs.", "Contexte métier sans coordonnées réelles."],
    steps: [
      "Créer une opportunité de prospection inversée.",
      "Qualifier le besoin sans publier automatiquement.",
      "Consulter les relations et propositions pertinentes.",
      "Comparer les résultats et conserver la décision sous contrôle humain.",
    ],
    expectedResult: "Le système propose des relations pertinentes sans contacter automatiquement les personnes concernées.",
    observation: "L'utilisateur doit observer des propositions contextualisées, leur provenance et les actions soumises à confirmation.",
    successCriterion: "Les propositions correspondent au besoin fictif et aucune identité ou prise de contact n'est révélée automatiquement.",
    failureAction: "Capturer les critères saisis et les propositions obtenues, puis réinitialiser les données de test.",
    href: "/opportunities/new?scenario=champagne-prospection-inversee",
    routeLabel: "Opportunités",
  },
  {
    id: "dossier-complexe-multi-acteurs",
    title: "Dossier complexe multi-acteurs",
    objective: "Orchestrer un dossier avec plusieurs parties, documents, actions et signaux de suivi.",
    demonstration: "Le workspace relationnel multi-acteurs, les documents, les actions, l'assistance IA et la gouvernance humaine.",
    prerequisites: ["Disposer d'un dossier de test accessible.", "Avoir au moins deux acteurs fictifs et plusieurs étapes de suivi."],
    requiredData: ["Acteurs et rôles fictifs.", "Documents factices non sensibles.", "Messages et demandes internes de test."],
    steps: [
      "Ouvrir l'espace Relations.",
      "Sélectionner ou créer un dossier fictif certifié.",
      "Tester actions, documents, messages internes et signaux IA sans notification réelle.",
      "Contrôler la situation du dossier et les validations humaines attendues.",
    ],
    expectedResult: "Le dossier centralise acteurs, documents, échanges et actions avec une chronologie cohérente.",
    observation: "L'utilisateur doit voir les responsabilités, éléments manquants, prochaines actions et preuves disponibles.",
    successCriterion: "Chaque action est traçable, aucune décision n'est automatique et les données restent associées au bon dossier.",
    failureAction: "Identifier l'étape ou l'acteur incohérent, conserver le dossier et signaler l'échec sans supprimer de données.",
    href: "/relations?scenario=champagne-dossier-complexe-multi-acteurs",
    routeLabel: "Relations",
  },
  {
    id: "qr-lien-securise",
    title: "QR Code / lien sécurisé",
    objective: "Valider la génération d'un lien sécurisé et son parcours candidat associé.",
    demonstration: "Le flux QR code, le lien sécurisé, l'accès candidat et la création d'une réponse gouvernée.",
    prerequisites: ["Disposer d'une opportunité publiée.", "Pouvoir ouvrir le lien public dans une session distincte."],
    requiredData: ["Annonce fictive publiée.", "Réponse candidat fictive.", "Document de test facultatif sans donnée réelle."],
    steps: [
      "Créer une opportunité ou ouvrir une opportunité existante.",
      "Vérifier le lien sécurisé et le QR code.",
      "Tester le formulaire candidat avec des données fictives certifiées.",
      "Contrôler que le dossier créé apparaît dans la relation correspondante.",
    ],
    expectedResult: "Le QR code ouvre le même lien sécurisé et la réponse candidat crée un dossier sans publication ou contact automatique supplémentaire.",
    observation: "L'utilisateur doit observer une annonce cohérente, un formulaire rendu correctement et un dossier lié à la bonne opportunité.",
    successCriterion: "Le lien fonctionne, la réponse est conservée par champ et aucune donnée personnelle non demandée n'est collectée.",
    failureAction: "Conserver l'URL et le message d'erreur, vérifier le statut de l'annonce, puis signaler l'échec.",
    href: "/opportunities?scenario=champagne-qr-lien-securise",
    routeLabel: "Opportunités",
  },
  {
    id: "multi-matching",
    title: "Multi-matching",
    objective: "Comparer plusieurs propositions et relations candidates dans le workspace normal.",
    demonstration: "Le matching multi-propositions, l'explication des rapprochements, les arbitrages humains et la valeur opérationnelle.",
    prerequisites: ["Disposer d'un dossier avec matching activé.", "Avoir plusieurs opportunités ou profils fictifs comparables."],
    requiredData: ["Besoin source fictif.", "Au moins trois propositions fictives.", "Critères de comparaison documentés."],
    steps: [
      "Ouvrir les relations.",
      "Identifier un dossier avec matching activé ou créer un cas de test fictif.",
      "Comparer les propositions et leurs explications.",
      "Mesurer la valeur depuis IA & Valeur sans lancer de contact automatique.",
    ],
    expectedResult: "Plusieurs propositions sont classées et expliquées sans masquer le contrôle humain.",
    observation: "L'utilisateur doit observer les éléments compatibles, les réserves et l'absence de contact automatique.",
    successCriterion: "Le classement est compréhensible, reproductible avec les mêmes données et chaque décision reste manuelle.",
    failureAction: "Noter le dossier, le scénario de matching et les écarts observés, puis relancer avec les mêmes données.",
    href: "/relations?scenario=champagne-multi-matching",
    routeLabel: "Relations",
  },
  {
    id: "cercle-hashtag",
    title: "Cercle / hashtag",
    objective: "Préfigurer des cercles de confiance et hashtags relationnels autour des parcours.",
    demonstration: "Une vision future de l'organisation collective par cercles et hashtags sans modification des règles Trust.",
    prerequisites: ["Disposer de plusieurs parcours fictifs.", "Conserver ce test au niveau d'exploration produit, sans automatisation."],
    requiredData: ["Noms de cercles fictifs.", "Hashtags métier non sensibles.", "Hypothèses de regroupement documentées."],
    steps: [
      "Ouvrir les parcours existants.",
      "Identifier les endroits où cercle, hashtag ou communauté pourraient enrichir le suivi.",
      "Noter les hypothèses produit sans automatiser de décision.",
      "Vérifier que la Trust Layer et les permissions existantes restent inchangées.",
    ],
    expectedResult: "Les usages possibles sont identifiés sans créer de permission, relation ou partage implicite.",
    observation: "L'utilisateur doit distinguer clairement la vision future des fonctions réellement actives.",
    successCriterion: "Les hypothèses sont documentées et aucune règle Trust, donnée ou relation existante n'est modifiée.",
    failureAction: "Arrêter le test si une action réelle est proposée, documenter l'écran concerné et signaler l'échec.",
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

function ScenarioTextBlock({ title, children, tone = "slate" }: { title: string; children: ReactNode; tone?: "slate" | "emerald" | "red" }) {
  const classes = tone === "emerald"
    ? "border-emerald-200 bg-emerald-50 text-emerald-950"
    : tone === "red"
      ? "border-red-200 bg-red-50 text-red-950"
      : "border-slate-200 bg-slate-50 text-slate-800";

  return (
    <section className={`rounded-xl border p-3 ${classes}`}>
      <h4 className="text-xs font-semibold uppercase tracking-wide">{title}</h4>
      <div className="mt-1 text-sm leading-6">{children}</div>
    </section>
  );
}

function ScenarioList({ items }: { items: string[] }) {
  return <ul className="space-y-1">{items.map((item) => <li key={item}>• {item}</li>)}</ul>;
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
                    </div>
                    <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusClasses(state)}`}>
                      {statusLabel(state)}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3">
                    <ScenarioTextBlock title="Objectif">{scenario.objective}</ScenarioTextBlock>
                    <ScenarioTextBlock title="Ce que démontre le scénario">{scenario.demonstration}</ScenarioTextBlock>
                    <div className="grid gap-3 md:grid-cols-2">
                      <ScenarioTextBlock title="Prérequis"><ScenarioList items={scenario.prerequisites} /></ScenarioTextBlock>
                      <ScenarioTextBlock title="Données nécessaires"><ScenarioList items={scenario.requiredData} /></ScenarioTextBlock>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Route produit</p>
                      <p className="mt-1 text-slate-700">{scenario.routeLabel}</p>
                    </div>
                  </div>

                  {isExpanded ? (
                    <div className="mt-4 space-y-3">
                      <section className="rounded-xl border border-slate-200 p-3">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Étapes</h4>
                        <ol className="mt-3 space-y-3 text-sm text-slate-700">
                          {scenario.steps.map((step, index) => (
                            <li key={step} className="flex gap-3">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{index + 1}</span>
                              <span className="pt-1">{step}</span>
                            </li>
                          ))}
                        </ol>
                      </section>
                      <ScenarioTextBlock title="Résultat attendu" tone="emerald">{scenario.expectedResult}</ScenarioTextBlock>
                      <ScenarioTextBlock title="Ce que l'utilisateur doit observer">{scenario.observation}</ScenarioTextBlock>
                      <ScenarioTextBlock title="Critère de réussite" tone="emerald">{scenario.successCriterion}</ScenarioTextBlock>
                      <ScenarioTextBlock title="Échec" tone="red">{scenario.failureAction}</ScenarioTextBlock>
                    </div>
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
                      {isExpanded ? "Masquer le protocole" : "Voir le protocole complet"}
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
