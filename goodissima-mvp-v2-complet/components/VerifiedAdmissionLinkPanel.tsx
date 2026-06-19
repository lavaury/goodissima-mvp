"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";

type VerifiedAdmissionTokenStatus = "ACTIVE" | "USED" | "EXPIRED" | "REVOKED";

type VerifiedAdmissionTokenSummary = {
  id: string;
  status: string;
  expiresAt: Date | string;
  usedAt?: Date | string | null;
  createdAt: Date | string;
};

type VerifiedAdmissionLinkResponse = {
  tokenId: string;
  admissionUrl: string;
  expiresAt: string;
  status: "ACTIVE";
};

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function getTokenStatus(token: VerifiedAdmissionTokenSummary): VerifiedAdmissionTokenStatus {
  if (token.status === "ACTIVE" && new Date(token.expiresAt).getTime() <= Date.now()) {
    return "EXPIRED";
  }

  if (
    token.status === "ACTIVE" ||
    token.status === "USED" ||
    token.status === "EXPIRED" ||
    token.status === "REVOKED"
  ) {
    return token.status;
  }

  return "EXPIRED";
}

function getLatestToken(tokens: VerifiedAdmissionTokenSummary[]) {
  return [...tokens].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  )[0] ?? null;
}

export function VerifiedAdmissionLinkPanel({
  gLinkId,
  tokens = [],
}: {
  gLinkId: string;
  tokens?: VerifiedAdmissionTokenSummary[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [revokingTokenId, setRevokingTokenId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [admissionLink, setAdmissionLink] = useState<VerifiedAdmissionLinkResponse | null>(null);
  const latestToken = getLatestToken(tokens);
  const latestTokenStatus = latestToken ? getTokenStatus(latestToken) : null;

  async function generateLink() {
    setLoading(true);

    try {
      const res = await fetch("/api/trust-admission-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gLinkId }),
      });

      if (!res.ok) {
        toast.error("Lien d'admission vérifiée non généré");
        return;
      }

      const body = (await res.json()) as VerifiedAdmissionLinkResponse;
      setAdmissionLink(body);
      setCopied(false);
      toast.success("Lien d'admission vérifiée créé");
      router.refresh();
    } catch {
      toast.error("Erreur lors de l'action");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!admissionLink) return;

    try {
      await navigator.clipboard.writeText(admissionLink.admissionUrl);
      setCopied(true);
      toast.success("Lien copié");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erreur lors de l'action");
    }
  }

  async function revokeLink(tokenId: string) {
    setRevokingTokenId(tokenId);

    try {
      const res = await fetch(`/api/trust-admission-tokens/${encodeURIComponent(tokenId)}/revoke`, {
        method: "POST",
      });

      if (!res.ok) {
        toast.error("Lien vérifié non révoqué");
        return;
      }

      if (admissionLink?.tokenId === tokenId) {
        setAdmissionLink(null);
      }

      toast.success("Lien vérifié révoqué");
      router.refresh();
    } catch {
      toast.error("Erreur lors de l'action");
    } finally {
      setRevokingTokenId(null);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
            Admission vérifiée
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-950">
            Utilisez ce lien lorsque vous souhaitez recevoir une candidature provenant d'une personne déjà
            vérifiée.
          </p>
          <p className="mt-2 text-xs text-emerald-800">
            Fonctionnalité en test : ce parcours est destiné aux démonstrations et aux premiers essais.
          </p>
        </div>
        <button
          type="button"
          onClick={generateLink}
          disabled={loading}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Génération..." : "Créer un lien vérifié"}
        </button>
      </div>

      {admissionLink ? (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-950">Lien vérifié créé</p>
          <p className="mt-1 text-sm text-slate-600">
            Valable jusqu'au : {dateFormatter.format(new Date(admissionLink.expiresAt))}
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              value={admissionLink.admissionUrl}
              readOnly
              className="min-h-11 w-full rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-800"
            />
            <button
              type="button"
              onClick={copyLink}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              {copied ? "Lien copié" : "Copier le lien"}
            </button>
            <button
              type="button"
              onClick={() => revokeLink(admissionLink.tokenId)}
              disabled={revokingTokenId === admissionLink.tokenId}
              className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {revokingTokenId === admissionLink.tokenId ? "Révocation..." : "Révoquer"}
            </button>
          </div>
        </div>
      ) : latestToken ? (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-white p-4">
          {latestTokenStatus === "ACTIVE" ? (
            <>
              <p className="text-sm font-semibold text-slate-950">Lien vérifié actif</p>
              <p className="mt-1 text-sm text-slate-600">
                Valable jusqu'au : {dateFormatter.format(new Date(latestToken.expiresAt))}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Ce lien ne peut être copié qu'au moment de sa création.
              </p>
              <button
                type="button"
                onClick={() => revokeLink(latestToken.id)}
                disabled={revokingTokenId === latestToken.id}
                className="mt-3 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {revokingTokenId === latestToken.id ? "Révocation..." : "Révoquer"}
              </button>
            </>
          ) : (
            <p className="text-sm font-semibold text-slate-950">
              {latestTokenStatus === "USED"
                ? "Dernier lien utilisé"
                : latestTokenStatus === "REVOKED"
                  ? "Dernier lien révoqué"
                  : "Dernier lien expiré"}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-950">Aucun lien vérifié actif</p>
        </div>
      )}
    </section>
  );
}
