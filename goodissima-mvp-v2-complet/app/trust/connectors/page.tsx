export const dynamic = "force-dynamic";

import { unstable_noStore as noStore } from "next/cache";
import { DashboardBackLink } from "@/components/DashboardBackLink";
import { LogoutButton } from "@/components/LogoutButton";
import { PlatformNavigation } from "@/components/PlatformNavigation";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type {
  TrustConnectorProviderType,
  TrustConnectorStatus,
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

const statusLabels: Record<TrustConnectorStatus, { label: string; className: string }> = {
  ACTIVE: {
    label: "Disponible",
    className: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  },
  DISABLED: {
    label: "Indisponible",
    className: "bg-slate-100 text-slate-700 ring-slate-200",
  },
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
            const status = statusLabels[connector.status];

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
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
