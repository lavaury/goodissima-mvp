"use client";

import { useMemo, useState } from "react";
import { useToast } from "@/components/ToastProvider";

const parisDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

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
  const toast = useToast();

  const expiresAt = candidateAccessExpiresAt ? new Date(candidateAccessExpiresAt) : null;
  const isActive = !candidateAccessRevokedAt && (!expiresAt || expiresAt > new Date());
  const securePath = isActive ? `/secure/${encodeURIComponent(candidateAccessToken)}` : null;
  const expiresAtLabel = useMemo(() => {
    if (!candidateAccessExpiresAt) return "Aucune expiration";

    return parisDateFormatter.format(new Date(candidateAccessExpiresAt));
  }, [candidateAccessExpiresAt]);
  const revokedAtLabel = candidateAccessRevokedAt
    ? parisDateFormatter.format(new Date(candidateAccessRevokedAt))
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
      toast.error("Erreur lors de l'action");
      return;
    }

    toast.success(action === "revoke" ? "Acces candidat revoque" : "Acces candidat regenere");
    window.setTimeout(() => window.location.reload(), 700);
  }

  return (
    <div className="rounded-2xl border bg-white p-4">
      <h2 className="font-semibold">Acces candidat</h2>
      <div className="mt-3 space-y-2 text-sm text-slate-600">
        {securePath ? (
          <p className="break-all">{securePath}</p>
        ) : (
          <p>Aucun lien candidat actif. Regenerez l'acces pour creer un nouveau lien securise.</p>
        )}
        <p>Expiration : {expiresAtLabel}</p>
        {revokedAtLabel ? <p>Revoque le : {revokedAtLabel}</p> : isActive ? <p>Acces actif</p> : <p>Acces expire</p>}
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
          {loading === "regenerate" ? "Régénération..." : "Régénérer"}
        </button>
      </div>
    </div>
  );
}
