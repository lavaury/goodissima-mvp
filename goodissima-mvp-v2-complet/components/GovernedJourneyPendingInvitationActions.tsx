"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GovernedJourneyPendingInvitationActions({
  invitationId,
}: {
  invitationId: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function revoke() {
    if (
      !window.confirm(
        "Révoquer cette invitation personnelle ? Le lien deviendra immédiatement inutilisable.",
      )
    )
      return;
    setBusy(true);
    setError(null);
    const response = await fetch(
      `/api/gouvernance/invitations/${invitationId}/revoke`,
      { method: "POST" },
    );
    setBusy(false);
    if (!response.ok) {
      setError("La révocation a échoué.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={busy}
        onClick={revoke}
        className="min-h-11 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-60"
      >
        {busy ? "Révocation…" : "Révoquer l’invitation"}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
