"use client";

import { useState } from "react";
import { useToast } from "@/components/ToastProvider";

export function MatchingOptInPanel({
  caseId,
  initialMatchingEnabled,
  candidateAccessToken,
  disabled = false,
  disabledReason,
  senderType,
}: {
  caseId: string;
  initialMatchingEnabled: boolean;
  candidateAccessToken?: string;
  disabled?: boolean;
  disabledReason?: string;
  senderType: "OWNER" | "CANDIDATE";
}) {
  const toast = useToast();
  const [enabled, setEnabled] = useState(initialMatchingEnabled);
  const [saving, setSaving] = useState(false);
  const isCandidate = senderType === "CANDIDATE";

  async function update(nextEnabled: boolean) {
    if (disabled) return;
    setSaving(true);
    const res = await fetch(`/api/cases/${encodeURIComponent(caseId)}/matching-opt-in`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchingEnabled: nextEnabled, candidateAccessToken }),
    });
    setSaving(false);

    if (!res.ok) {
      toast.error("Matching non modifie");
      return;
    }

    setEnabled(nextEnabled);
    window.dispatchEvent(new CustomEvent("goodissima:matching-opt-in", { detail: { caseId, matchingEnabled: nextEnabled } }));
    toast.success("Preference matching mise a jour");
  }

  return (
    <section
      data-boussole-id="candidate-case-matching"
      data-boussole-state={enabled ? "enabled" : "disabled"}
      className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5 lg:p-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">
            {isCandidate ? "Opportunites compatibles" : "Matching relationnel"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {isCandidate
              ? "Je souhaite etre considere pour des opportunites compatibles."
              : "Activer le matching pour ce dossier."}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Opt-in uniquement. Aucune identite n'est revelee automatiquement.
          </p>
          {disabled ? (
            <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
              {disabledReason ?? "Le matching est bloque pour cette relation."}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={disabled || saving}
          onClick={() => void update(!enabled)}
          className={["relative h-7 w-12 shrink-0 rounded-full transition", enabled ? "bg-slate-900" : "bg-slate-200"].join(" ")}
        >
          <span className={["absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition", enabled ? "left-6" : "left-1"].join(" ")} />
        </button>
      </div>
    </section>
  );
}
