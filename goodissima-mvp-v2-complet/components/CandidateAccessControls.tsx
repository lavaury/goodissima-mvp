"use client";

import { useMemo, useState } from "react";

export function CandidateAccessControls({
  caseId,
  candidateAccessToken,
  candidateAccessExpiresAt,
  candidateAccessRevokedAt,
}: {
  caseId: string;
  candidateAccessToken: string;
  candidateAccessExpiresAt?: Date | string | null;
  candidateAccessRevokedAt?: Date | string | null;
}) {
  const [loading, setLoading] = useState<"revoke" | "regenerate" | null>(null);

  const securePath = `/secure/${encodeURIComponent(candidateAccessToken)}`;
  const expiresAtLabel = useMemo(() => {
    if (!candidateAccessExpiresAt) return "Aucune expiration";

    return new Date(candidateAccessExpiresAt).toLocaleString("fr-FR");
  }, [candidateAccessExpiresAt]);
  const revokedAtLabel = candidateAccessRevokedAt
    ? new Date(candidateAccessRevokedAt).toLocaleString("fr-FR")
    : null;

  async function postAction(action: "revoke" | "regenerate") {
    setLoading(action);
    const res = await fetch(
      `/api/cases/${encodeURIComponent(caseId)}/candidate-access/${
        action === "revoke" ? "revoke" : "regenerate-token"
      }`,
      {
        method: "POST",
      },
    );
    setLoading(null);

    if (!res.ok) {
      alert("Impossible de modifier l'acces candidat.");
      return;
    }

    window.location.reload();
  }

  return (
    <div className="rounded-2xl border bg-white p-4">
      <h2 className="font-semibold">Acces candidat</h2>
      <div className="mt-3 space-y-2 text-sm text-slate-600">
        <p className="break-all">{securePath}</p>
        <p>Expiration : {expiresAtLabel}</p>
        {revokedAtLabel ? <p>Revoque le : {revokedAtLabel}</p> : <p>Acces actif</p>}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => postAction("revoke")}
          disabled={loading !== null || Boolean(candidateAccessRevokedAt)}
          className="rounded-xl border px-3 py-2 text-sm disabled:opacity-50"
        >
          {loading === "revoke" ? "Revocation..." : "Revoquer"}
        </button>
        <button
          type="button"
          onClick={() => postAction("regenerate")}
          disabled={loading !== null}
          className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {loading === "regenerate" ? "Regeneration..." : "Regenerer"}
        </button>
      </div>
    </div>
  );
}
