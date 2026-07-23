"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ToastProvider";

type MatchingRunStatus = "PREPARED" | "RUNNING" | "RESULTS_AVAILABLE" | "FAILED" | "CLOSED";
type MatchingResultStatus = "AVAILABLE" | "SELECTED" | "DISMISSED" | "LINKED";

type MatchingRunView = {
  id: string;
  status: MatchingRunStatus;
  isPaused: boolean;
  createdAt: string;
  startedAt?: string | null;
  completedAt: string | null;
  failedAt?: string | null;
  failureCode: string | null;
};

type MatchingResultView = {
  id: string;
  targetGLinkId: string;
  status: MatchingResultStatus;
  explanation: {
    summary: string;
    signals: string[];
    cautions?: string[];
    engine: string;
  };
  internalRank: number | null;
};

type MatchingViewPayload = {
  enabled?: boolean;
  run: MatchingRunView;
  results: MatchingResultView[];
};

type MatchingReadPayload = {
  enabled: boolean;
  run: MatchingRunView | null;
  results: MatchingResultView[];
};

type LegacyMatchItem = {
  relationId: string;
  pseudonym: string;
  explanation: {
    compatibleElements: string[];
    semanticSignals?: string[];
    clarificationsNeeded: string[];
    warnings: string[];
  };
};

const MAX_POLL_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 4000;

export function GLinkMatchingPanel({
  linkId,
  criteriaSufficient,
  initialEnabled,
}: {
  linkId: string;
  criteriaSufficient: boolean;
  initialMatches: LegacyMatchItem[];
  initialAnalyzed: boolean;
  initialEnabled: boolean;
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [updatingEnabled, setUpdatingEnabled] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [run, setRun] = useState<MatchingRunView | null>(null);
  const [results, setResults] = useState<MatchingResultView[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<string, "INTERESTING" | "IGNORED">>({});
  const [decidingTargets, setDecidingTargets] = useState<Record<string, boolean>>({});
  const attemptKey = useRef<string | null>(null);
  const pollAttempts = useRef(0);
  const enabledMutationPending = useRef(false);
  const decisionPending = useRef(new Set<string>());

  const applyPayload = useCallback((payload: MatchingReadPayload | MatchingViewPayload) => {
    if ("enabled" in payload && typeof payload.enabled === "boolean") setEnabled(payload.enabled);
    setRun(payload.run);
    setResults(payload.results);
    setErrorMessage(null);
  }, []);

  const readPersistentState = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(`/api/links/${encodeURIComponent(linkId)}/matching`, {
      method: "GET",
      signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(response.status === 404 ? "LINK_NOT_FOUND" : "READ_FAILED");
    const payload = await response.json() as MatchingReadPayload;
    applyPayload(payload);
    return payload;
  }, [applyPayload, linkId]);

  useEffect(() => {
    const controller = new AbortController();
    setInitialLoading(true);
    readPersistentState(controller.signal)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setErrorMessage(error instanceof Error && error.message === "LINK_NOT_FOUND"
            ? "Lien introuvable."
            : "Impossible de charger l’état du matching.");
        }
      })
      .finally(() => setInitialLoading(false));
    return () => controller.abort();
  }, [readPersistentState]);

  useEffect(() => {
    if (run?.status !== "RUNNING" || run.isPaused || pollAttempts.current >= MAX_POLL_ATTEMPTS) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      pollAttempts.current += 1;
      readPersistentState(controller.signal).catch(() => undefined);
    }, POLL_INTERVAL_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [readPersistentState, run]);

  async function changeEnabled(nextEnabled: boolean) {
    if (enabledMutationPending.current) return;
    if (nextEnabled && !window.confirm("Activer le matching relationnel pour ce lien ? L’analyse restera déclenchée manuellement et aucun contact automatique ne sera créé.")) return;
    enabledMutationPending.current = true;
    setUpdatingEnabled(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/links/${encodeURIComponent(linkId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "matching", matchingEnabled: nextEnabled }),
      });
      if (!response.ok) {
        const message = "L’état du matching n’a pas pu être modifié.";
        setErrorMessage(message);
        toast.error(message);
        return;
      }
      setEnabled(nextEnabled);
      if (!nextEnabled) {
        setRun(null);
        setResults([]);
        toast.success("Matching désactivé.");
        return;
      }
      toast.success("Matching activé. Analyse manuelle disponible.");
      try {
        await readPersistentState();
      } catch {
        const message = "Le matching est activé, mais son dernier état n’a pas pu être rechargé.";
        setErrorMessage(message);
        toast.error(message);
      }
    } catch {
      const message = "Impossible de modifier le matching. Vérifiez votre connexion et réessayez.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      enabledMutationPending.current = false;
      setUpdatingEnabled(false);
    }
  }

  async function analyze() {
    if (loading || run?.status === "RUNNING") return;
    setLoading(true);
    setErrorMessage(null);
    pollAttempts.current = 0;
    const key = attemptKey.current ?? createAttemptKey();
    attemptKey.current = key;
    try {
      const response = await fetch(`/api/links/${encodeURIComponent(linkId)}/matching`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
      });
      const payload = await response.json() as MatchingViewPayload & { error?: string };
      if (!response.ok) {
        attemptKey.current = null;
        const message = userFacingPostError(response.status, payload.error);
        setErrorMessage(message);
        toast.error(message);
        return;
      }
      attemptKey.current = null;
      applyPayload(payload);
      toast.success(payload.run.status === "RESULTS_AVAILABLE"
        ? "Correspondances actualisées"
        : "Analyse prise en compte");
    } catch {
      const message = "La connexion a été interrompue. Réessayez pour reprendre la même tentative.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function decide(targetGLinkId: string, decision: "INTERESTING" | "IGNORED") {
    if (decisionPending.current.has(targetGLinkId)) return;
    decisionPending.current.add(targetGLinkId);
    setDecidingTargets((current) => ({ ...current, [targetGLinkId]: true }));
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/links/${encodeURIComponent(linkId)}/matching`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: targetGLinkId, decision }),
      });
      if (!response.ok) {
        const message = "La décision n’a pas pu être enregistrée.";
        setErrorMessage(message);
        toast.error(message);
        return;
      }
      setDecisions((current) => ({ ...current, [targetGLinkId]: decision }));
      toast.success(decision === "INTERESTING" ? "Correspondance marquée intéressante" : "Correspondance ignorée");
    } catch {
      const message = "Impossible d’enregistrer la décision. Vérifiez votre connexion et réessayez.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      decisionPending.current.delete(targetGLinkId);
      setDecidingTargets((current) => ({ ...current, [targetGLinkId]: false }));
    }
  }

  const boussoleState = !enabled
    ? "disabled"
    : run?.isPaused
      ? "paused"
      : run?.status.toLowerCase().replace("_", "-") ?? "to-analyze";
  const launchDisabled = loading || initialLoading || !criteriaSufficient || run?.status === "RUNNING" || run?.isPaused;

  return (
    <section
      id="matching"
      data-boussole-id="link-matching-status"
      data-boussole-state={boussoleState}
      className="mt-6 scroll-mt-6 rounded-2xl border bg-white p-5 shadow-sm"
      aria-busy={loading || initialLoading || updatingEnabled}
      aria-describedby={errorMessage ? "matching-error" : undefined}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-[#247f88]">Matching du lien</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">Correspondances potentielles à examiner</h2>
          <p className="mt-1 text-sm text-slate-500">Analyse prudente du besoin initial. Aucun contact automatique.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full px-3 py-2 text-xs font-bold ${enabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
            Matching relationnel : {enabled ? "Activé" : "Désactivé"}
          </span>
          <button type="button" data-boussole-id={enabled ? "disable-link-matching" : "enable-link-matching"} onClick={() => changeEnabled(!enabled)} disabled={updatingEnabled} className="rounded-xl border px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
            {updatingEnabled ? "Mise à jour…" : enabled ? "Désactiver" : "Activer le matching"}
          </button>
          {enabled ? (
            <button type="button" data-boussole-id="analyze-link-matching" onClick={analyze} disabled={launchDisabled} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
              {launchButtonLabel({ loading, run })}
            </button>
          ) : null}
        </div>
      </div>

      <div aria-live="polite">
        {initialLoading ? <p className="mt-5 rounded-xl border border-dashed p-4 text-sm text-slate-600">Chargement de l’état du matching…</p> : null}
        {!initialLoading && !enabled ? <p className="mt-5 rounded-xl border border-dashed p-4 text-sm text-slate-600">Activez explicitement le matching pour rendre l’analyse disponible. Aucune analyse n’est lancée automatiquement.</p> : null}
        {enabled && !criteriaSufficient ? <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Les critères du lien ne permettent pas encore une analyse pertinente.</p> : null}
        {enabled && criteriaSufficient ? <RunStatusMessage run={run} resultCount={results.length} /> : null}
        {errorMessage ? <p id="matching-error" role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{errorMessage}</p> : null}
      </div>

      {enabled && results.length ? (
        <div className="mt-5 space-y-3">
          <p className="text-sm font-semibold text-slate-700">{results.length} correspondance{results.length > 1 ? "s" : ""} à examiner humainement</p>
          {results.filter((result) => decisions[result.targetGLinkId] !== "IGNORED").map((result) => (
            <article key={result.id} data-boussole-id="review-link-matches" className="rounded-xl border bg-slate-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-bold text-slate-950">{resultPseudonym(result)}</h3>
                  <p className="mt-1 text-sm text-slate-700">{result.explanation.summary}</p>
                  <p className="mt-1 text-xs text-slate-500">Aucune identité révélée · aucun score présenté comme vérité</p>
                </div>
                {run?.status === "RESULTS_AVAILABLE" && !run.isPaused ? (
                  <div className="flex gap-2">
                    <button type="button" data-boussole-id="decide-link-match" onClick={() => decide(result.targetGLinkId, "INTERESTING")} disabled={decidingTargets[result.targetGLinkId]} className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-bold text-emerald-800 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                      {decisions[result.targetGLinkId] === "INTERESTING" ? "Intéressante" : "Marquer intéressante"}
                    </button>
                    <button type="button" onClick={() => decide(result.targetGLinkId, "IGNORED")} disabled={decidingTargets[result.targetGLinkId]} className="rounded-lg border bg-white px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Ignorer</button>
                  </div>
                ) : null}
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <ResultList title="Signaux favorables" items={result.explanation.signals} />
                <ResultList title="Éléments à vérifier" items={result.explanation.cautions ?? []} />
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function RunStatusMessage({ run, resultCount }: { run: MatchingRunView | null; resultCount: number }) {
  if (!run) return <p className="mt-5 rounded-xl border border-dashed p-4 text-sm text-slate-600">Aucune analyse n’a encore été lancée.</p>;
  if (run.isPaused) return <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Analyse suspendue. Les résultats existants restent consultables.</p>;
  if (run.status === "PREPARED") return <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">Analyse préparée.</p>;
  if (run.status === "RUNNING") return <p className="mt-5 rounded-xl bg-cyan-50 p-4 text-sm text-cyan-900">Analyse en cours.</p>;
  if (run.status === "FAILED") return <p className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">L’analyse n’a pas pu aboutir.</p>;
  if (run.status === "CLOSED") return <p className="mt-5 rounded-xl bg-slate-100 p-4 text-sm text-slate-700">Cette analyse est clôturée. Ses résultats sont conservés en lecture seule.</p>;
  return resultCount === 0
    ? <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Aucune correspondance exploitable pour le moment.</p>
    : null;
}

function launchButtonLabel({ loading, run }: { loading: boolean; run: MatchingRunView | null }) {
  if (loading) return "Analyse en cours de lancement";
  if (run?.status === "RUNNING") return "Analyse en cours";
  if (run?.status === "FAILED") return "Relancer une nouvelle analyse";
  if (run?.status === "RESULTS_AVAILABLE" || run?.status === "CLOSED") return "Lancer une nouvelle analyse";
  return "Lancer une analyse";
}

function ResultList({ title, items }: { title: string; items: string[] }) {
  return items.length ? (
    <div className="rounded-lg bg-white p-3">
      <p className="text-xs font-bold text-[#247f88]">{title}</p>
      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-600">{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </div>
  ) : null;
}

function resultPseudonym(result: MatchingResultView) {
  if (Number.isInteger(result.internalRank) && (result.internalRank ?? -1) >= 0) {
    return `Opportunité compatible ${(result.internalRank ?? 0) + 1}`;
  }
  let hash = 0;
  for (const character of result.targetGLinkId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return `Opportunité compatible ${100 + (hash % 900)}`;
}

function createAttemptKey() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function userFacingPostError(status: number, code?: string) {
  if (status === 404) return "Lien introuvable.";
  if (code === "MATCHING_DISABLED") return "Activez le matching pour lancer une analyse.";
  if (code === "MATCHING_CRITERIA_INSUFFICIENT") return "Les critères du lien ne permettent pas encore une analyse pertinente.";
  if (code === "MATCHING_EXECUTION_IN_PROGRESS") return "Une analyse est déjà en cours.";
  return "L’analyse n’a pas pu être lancée. Réessayez plus tard.";
}
