export const dynamic = "force-dynamic";

import { unstable_noStore as noStore } from "next/cache";
import { DashboardBackLink } from "@/components/DashboardBackLink";
import { LogoutButton } from "@/components/LogoutButton";
import { PlatformNavigation } from "@/components/PlatformNavigation";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type {
  TrustConnectorProviderType,
  TrustedOrganizationStatus,
} from "@prisma/client";

const connectorNameLabels: Record<string, string> = {
  GOODISSIMA_DEMO_AUTHORITY: "Autorité de démonstration Goodissima",
  FRANCE_IDENTITE: "France Identité",
  EIDAS_WALLET: "Portefeuille d'identité européen",
  BANK_CONNECT: "Connecteur bancaire",
  EDUCATION_PROVIDER: "Établissement d'enseignement",
};

const providerTypeLabels: Record<TrustConnectorProviderType, string> = {
  DEMO: "Démonstration",
  GOVERNMENT: "Administration publique",
  EUROPEAN_WALLET: "Portefeuille européen",
  BANK: "Banque",
  INSURANCE: "Assurance",
  EDUCATION: "Éducation",
  PROFESSIONAL_BODY: "Ordre professionnel",
  OTHER: "Autre source",
};

const connectorJourneySteps: Record<string, string[]> = {
  GOODISSIMA_DEMO_AUTHORITY: [
    "Goodissima",
    "Autorité de démonstration",
    "Émission d'une attestation de test",
    "Candidat vérifié en environnement pilote",
  ],
  FRANCE_IDENTITE: [
    "Goodissima",
    "France Identité",
    "Vérification d'identité",
    "Attestation d'identité",
    "Retour Goodissima",
    "Candidat vérifié",
  ],
  EIDAS_WALLET: [
    "Goodissima",
    "Portefeuille d'identité européen",
    "Partage d'attestation",
    "Retour Goodissima",
    "Candidat vérifié",
  ],
  BANK_CONNECT: [
    "Goodissima",
    "Connecteur bancaire",
    "Confirmation du statut client",
    "Attestation bancaire",
    "Retour Goodissima",
  ],
  EDUCATION_PROVIDER: [
    "Goodissima",
    "Établissement d'enseignement",
    "Confirmation du diplôme ou statut étudiant",
    "Attestation",
    "Retour Goodissima",
  ],
};

const trustedOrganizationStatusLabels: Record<TrustedOrganizationStatus, string> = {
  PENDING: "En attente",
  TRUSTED: "Source de confiance",
  SUSPENDED: "Suspendue",
  REVOKED: "Révoquée",
};

function getConnectorName(code: string, name: string) {
  return connectorNameLabels[code] ?? name;
}

function getTrustedOrganizationLabel(organizationId: string) {
  return connectorNameLabels[organizationId] ?? "Source de confiance associée";
}

function getConnectorDisplayStatus(code: string) {
  if (code === "GOODISSIMA_DEMO_AUTHORITY") {
    return {
      label: "Disponible",
      className: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    };
  }

  return {
    label: "Prévu",
    className: "bg-sky-50 text-sky-800 ring-sky-200",
  };
}

function getConnectorJourneySteps(code: string) {
  return connectorJourneySteps[code] ?? [
    "Goodissima",
    "Source de confiance",
    "Attestation",
    "Retour Goodissima",
  ];
}

export default async function TrustConnectorsPage() {
  noStore();

  const owner = await getCurrentPrismaUser();
  const organizationName = owner.name && owner.name !== owner.email ? owner.name : "Organisation Goodissima";
  const connectors = await prisma.trustConnector.findMany({
    orderBy: [{ providerType: "asc" }, { name: "asc" }],
    select: {
      code: true,
      name: true,
      description: true,
      status: true,
      providerType: true,
      trustedOrganization: {
        select: {
          organizationId: true,
          status: true,
        },
      },
    },
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <DashboardBackLink className="mb-4" />
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Registre de confiance
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Connecteurs de confiance</h1>
          <p className="mt-2 max-w-3xl text-slate-500">
            Goodissima peut s'appuyer sur plusieurs sources de confiance pour recevoir des attestations :
            identité, banque, diplôme, statut professionnel.
          </p>
        </div>
        <LogoutButton />
      </div>

      <PlatformNavigation active="trust" organizationName={organizationName} />

      <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <p className="text-sm font-semibold text-amber-950">
          Seule l'autorité de démonstration est active aujourd'hui. Les autres connecteurs illustrent les
          intégrations prévues.
        </p>
      </section>

      {connectors.length === 0 ? (
        <section className="rounded-2xl border bg-white p-8 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Aucun connecteur référencé</h2>
          <p className="mt-2 text-sm text-slate-500">
            Les sources de confiance apparaîtront ici lorsqu'elles seront disponibles.
          </p>
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2">
          {connectors.map((connector) => {
            const status = getConnectorDisplayStatus(connector.code);
            const journeySteps = getConnectorJourneySteps(connector.code);

            return (
              <article key={connector.code} className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {providerTypeLabels[connector.providerType]}
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-slate-950">
                      {getConnectorName(connector.code, connector.name)}
                    </h2>
                  </div>
                  <span
                    className={`self-start rounded-full px-3 py-1 text-xs font-medium ring-1 ${status.className}`}
                  >
                    {status.label}
                  </span>
                </div>

                <p className="mt-4 min-h-12 text-sm leading-6 text-slate-600">
                  {connector.description ?? "Source de confiance prévue pour de futures attestations."}
                </p>

                <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Émetteur de confiance
                  </p>
                  {connector.trustedOrganization ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">
                        {getTrustedOrganizationLabel(connector.trustedOrganization.organizationId)}
                      </span>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600 ring-1 ring-slate-200">
                        {trustedOrganizationStatusLabels[connector.trustedOrganization.status]}
                      </span>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">Aucun émetteur associé pour le moment.</p>
                  )}
                </div>

                <details className="group mt-4 rounded-xl border bg-white px-4 py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-900">
                    Voir le parcours
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
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
