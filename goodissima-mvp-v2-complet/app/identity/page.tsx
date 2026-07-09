export const dynamic = "force-dynamic";

import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { DashboardBackLink } from "@/components/DashboardBackLink";
import { DemoCredentialRevocationButton } from "@/components/DemoCredentialRevocationButton";
import { DemoIdentityVerificationButton } from "@/components/DemoIdentityVerificationButton";
import { LogoutButton } from "@/components/LogoutButton";
import { PlatformNavigation } from "@/components/PlatformNavigation";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  demoTrustConnectorCode,
  getConnectorDescription,
  getConnectorDisplayStatus,
  getConnectorJourneySteps,
  getConnectorName,
} from "@/lib/trust-connectors-display";
import {
  getActiveCredentialsForIdentity,
  getCredentialsForIdentityHistory,
} from "@/lib/trust-credentials";
import { getOrCreateGoodissimaIdentityForUser } from "@/lib/user-identity";
import { TrustCredentialStatus, type IdentityStatus } from "@prisma/client";

const identityStatusDisplay: Record<
  IdentityStatus,
  { label: string; className: string; help: string }
> = {
  UNVERIFIED: {
    label: "Non vérifiée",
    className: "bg-amber-50 text-amber-900 ring-amber-200",
    help: "Votre identité Goodissima existe, mais aucune vérification n'est encore enregistrée.",
  },
  VERIFIED: {
    label: "Vérifiée",
    className: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    help: "Votre identité Goodissima dispose d'un statut vérifié.",
  },
  SUSPENDED: {
    label: "Suspendue",
    className: "bg-orange-50 text-orange-900 ring-orange-200",
    help: "Votre identité Goodissima est suspendue.",
  },
  REVOKED: {
    label: "Révoquée",
    className: "bg-red-50 text-red-900 ring-red-200",
    help: "Votre identité Goodissima est révoquée.",
  },
};

const credentialTypeLabels: Record<string, string> = {
  VERIFIED_IDENTITY: "Identité vérifiée",
  CANDIDATE_CREATED: "Candidature créée",
};

const VERIFIED_IDENTITY = "VERIFIED_IDENTITY";
const DEMO_ISSUER_ORGANIZATION_ID = "GOODISSIMA_DEMO_AUTHORITY";

const issuerLabels: Record<string, string> = {
  GOODISSIMA_SYSTEM: "Goodissima",
  GOODISSIMA_DEMO_AUTHORITY: "Autorité de démonstration Goodissima",
  FRANCE_IDENTITE: "France Identité",
  EIDAS_WALLET: "Portefeuille d'identité européen",
  BANK_CONNECT: "Connecteur bancaire",
  EDUCATION_PROVIDER: "Établissement d'enseignement",
};

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const credentialHistoryStatusDisplay: Record<
  TrustCredentialStatus,
  { label: string; className: string }
> = {
  ACTIVE: {
    label: "Active",
    className: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  },
  EXPIRED: {
    label: "Expirée",
    className: "bg-slate-100 text-slate-700 ring-slate-200",
  },
  SUSPENDED: {
    label: "Suspendue",
    className: "bg-orange-50 text-orange-900 ring-orange-200",
  },
  REVOKED: {
    label: "Révoquée",
    className: "bg-red-50 text-red-900 ring-red-200",
  },
};

function humanizeCode(value: string) {
  const label = value
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .join(" ");

  return label ? label.charAt(0).toUpperCase() + label.slice(1) : "Attestation";
}

function getCredentialTypeLabel(code: string) {
  return credentialTypeLabels[code] ?? humanizeCode(code);
}

function getIssuerLabel(organizationId: string) {
  return issuerLabels[organizationId] ?? humanizeCode(organizationId);
}

function isCredentialExpiredByDate(credential: { expiresAt: Date | null }) {
  return Boolean(credential.expiresAt && credential.expiresAt.getTime() <= Date.now());
}

function getCredentialHistoryStatusDisplay(credential: {
  status: TrustCredentialStatus;
  expiresAt: Date | null;
}) {
  if (credential.status === TrustCredentialStatus.ACTIVE && isCredentialExpiredByDate(credential)) {
    return credentialHistoryStatusDisplay.EXPIRED;
  }

  return credentialHistoryStatusDisplay[credential.status];
}

function isActiveDemoVerifiedIdentityCredential(credential: {
  credentialType: { code: string };
  issuerTrustedOrganization: { organizationId: string };
}) {
  return (
    credential.credentialType.code === VERIFIED_IDENTITY &&
    credential.issuerTrustedOrganization.organizationId === DEMO_ISSUER_ORGANIZATION_ID
  );
}

const attestationExamples = [
  "Identité vérifiée",
  "Attestation bancaire",
  "Diplôme ou statut étudiant",
  "Assurance",
  "Statut professionnel",
];

export default async function IdentityPage() {
  noStore();

  const currentUser = await getCurrentPrismaUser();
  const organizationName =
    currentUser.name && currentUser.name !== currentUser.email
      ? currentUser.name
      : "Organisation Goodissima";
  const identityLink = await getOrCreateGoodissimaIdentityForUser(prisma, {
    userId: currentUser.id,
  });
  const [identity, activeCredentials, credentialHistory, trustConnectors] = await Promise.all([
    prisma.goodissimaIdentity.findUnique({
      where: { id: identityLink.identityId },
      select: {
        status: true,
        type: true,
        createdAt: true,
      },
    }),
    getActiveCredentialsForIdentity(prisma, identityLink.identityId),
    getCredentialsForIdentityHistory(prisma, identityLink.identityId),
    prisma.trustConnector.findMany({
      orderBy: [{ providerType: "asc" }, { name: "asc" }],
      select: {
        code: true,
        name: true,
        description: true,
      },
    }),
  ]);

  if (!identity) {
    throw new Error("Goodissima identity not found after creation.");
  }

  const statusDisplay = identityStatusDisplay[identity.status];
  const inactiveCredentialHistory = credentialHistory.filter(
    (credential) =>
      credential.status !== TrustCredentialStatus.ACTIVE || isCredentialExpiredByDate(credential),
  );
  const hasActiveDemoVerifiedIdentityCredential = activeCredentials.some(
    isActiveDemoVerifiedIdentityCredential,
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <DashboardBackLink className="mb-4" />
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Mon identité
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Mon identité</h1>
          <p className="mt-2 max-w-3xl text-slate-500">
            Gérez votre identité Goodissima et les attestations utilisables dans vos parcours relationnels.
          </p>
        </div>
        <LogoutButton />
      </div>

      <PlatformNavigation active="identity" organizationName={organizationName} />

      <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            L'annuaire Goodissima V1 prépare l'espace transversal des identités, organisations et contacts de confiance.
          </p>
          <Link href="/annuaire" className="w-fit rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700">
            Consulter l'annuaire
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Statut
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">
              Identité {identity.type === "PERSON" ? "personnelle" : "organisation"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {statusDisplay.help}
            </p>
          </div>
          <span
            className={`self-start rounded-full px-3 py-1 text-sm font-medium ring-1 ${statusDisplay.className}`}
          >
            {statusDisplay.label}
          </span>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Mes attestations
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">
              Obtenir une attestation
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Vous pouvez obtenir une attestation auprès d'une source de confiance. Certaines sont déjà
              disponibles, d'autres seront proposées prochainement.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {attestationExamples.map((example) => (
                <span
                  key={example}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                >
                  {example}
                </span>
              ))}
            </div>
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950">
              Fonctionnalité de démonstration : aucune vérification officielle n’est réalisée.
            </p>
          </div>

          {trustConnectors.length === 0 ? (
            <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
              Aucune source de confiance référencée pour le moment.
            </p>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {trustConnectors.map((connector) => {
                const status = getConnectorDisplayStatus(connector.code);
                const journeySteps = getConnectorJourneySteps(connector.code);
                const isDemoConnector = connector.code === demoTrustConnectorCode;

                return (
                  <article
                    key={connector.code}
                    className={
                      isDemoConnector
                        ? "rounded-xl border border-emerald-200 bg-emerald-50 p-4"
                        : "rounded-xl border bg-slate-50 p-4"
                    }
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-slate-950">
                          {getConnectorName(connector.code, connector.name)}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {getConnectorDescription(connector.code, connector.description)}
                        </p>
                      </div>
                      <span
                        className={`self-start rounded-full px-3 py-1 text-xs font-medium ring-1 ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </div>

                    {isDemoConnector ? (
                      <div className="mt-4">
                        <DemoIdentityVerificationButton />
                      </div>
                    ) : (
                      <details className="group mt-4 rounded-xl border bg-white px-4 py-3">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-900">
                          Flux prévu
                          <span className="text-xs text-slate-500 transition group-open:rotate-180">v</span>
                        </summary>
                        <ol className="mt-4 space-y-3">
                          {journeySteps.map((step, index) => (
                            <li key={`${connector.code}-${step}`} className="flex gap-3 text-sm">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                                {index + 1}
                              </span>
                              <span className="pt-0.5 text-slate-700">{step}</span>
                            </li>
                          ))}
                        </ol>
                      </details>
                    )}
                  </article>
                );
              })}
            </div>
          )}
      </section>

      <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Attestations
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">
              Attestations actives
            </h2>
          </div>
          <span className="self-start rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {activeCredentials.length} active{activeCredentials.length > 1 ? "s" : ""}
          </span>
        </div>

        {activeCredentials.length === 0 ? (
          <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            Aucune attestation active pour le moment.
          </p>
        ) : (
          <>
            {hasActiveDemoVerifiedIdentityCredential ? (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-medium text-red-950">
                  La révocation est immédiate et peut empêcher l'accès aux relations nécessitant une identité vérifiée.
                </p>
                <div className="mt-3">
                  <DemoCredentialRevocationButton />
                </div>
              </div>
            ) : null}
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {activeCredentials.map((credential) => (
                <article key={credential.id} className="rounded-xl border bg-slate-50 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        {getCredentialTypeLabel(credential.credentialType.code)}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Émetteur : {getIssuerLabel(credential.issuerTrustedOrganization.organizationId)}
                      </p>
                    </div>
                    <span className="self-start rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                      Active
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Émise le {dateFormatter.format(credential.issuedAt)}
                  </p>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Historique
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">
              Historique des attestations
            </h2>
          </div>
          <span className="self-start rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {inactiveCredentialHistory.length} historique{inactiveCredentialHistory.length > 1 ? "s" : ""}
          </span>
        </div>

        {inactiveCredentialHistory.length === 0 ? (
          <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            Aucun historique d'attestation non active pour le moment.
          </p>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {inactiveCredentialHistory.map((credential) => {
              const status = getCredentialHistoryStatusDisplay(credential);

              return (
                <article key={credential.id} className="rounded-xl border bg-slate-50 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        {getCredentialTypeLabel(credential.credentialType.code)}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Emetteur : {getIssuerLabel(credential.issuerTrustedOrganization.organizationId)}
                      </p>
                    </div>
                    <span
                      className={`self-start rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-slate-500">
                    <p>Emise le {dateFormatter.format(credential.issuedAt)}</p>
                    {credential.expiresAt ? (
                      <p>Expiration le {dateFormatter.format(credential.expiresAt)}</p>
                    ) : null}
                    {credential.revokedAt ? (
                      <p>Revoquee le {dateFormatter.format(credential.revokedAt)}</p>
                    ) : null}
                    {credential.revocationReason ? (
                      <p>Raison : {credential.revocationReason}</p>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
