export const dynamic = "force-dynamic";

import { unstable_noStore as noStore } from "next/cache";
import { DashboardBackLink } from "@/components/DashboardBackLink";
import { DemoIdentityVerificationButton } from "@/components/DemoIdentityVerificationButton";
import { LogoutButton } from "@/components/LogoutButton";
import { PlatformNavigation } from "@/components/PlatformNavigation";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCredentialsForIdentity } from "@/lib/trust-credentials";
import { getOrCreateGoodissimaIdentityForUser } from "@/lib/user-identity";
import type { IdentityStatus } from "@prisma/client";

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
  const [identity, activeCredentials] = await Promise.all([
    prisma.goodissimaIdentity.findUnique({
      where: { id: identityLink.identityId },
      select: {
        status: true,
        type: true,
        createdAt: true,
      },
    }),
    getActiveCredentialsForIdentity(prisma, identityLink.identityId),
  ]);

  if (!identity) {
    throw new Error("Goodissima identity not found after creation.");
  }

  const statusDisplay = identityStatusDisplay[identity.status];

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <DashboardBackLink className="mb-4" />
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Identité Goodissima
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Mon identité</h1>
          <p className="mt-2 max-w-3xl text-slate-500">
            Cette page affiche l'identité rattachée à votre compte connecté.
          </p>
        </div>
        <LogoutButton />
      </div>

      <PlatformNavigation active="identity" organizationName={organizationName} />

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

      {identity.status !== "VERIFIED" ? (
        <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
                Vérification démo
              </p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">
                Vérifier mon identité
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-950">
                Cette démonstration simule une vérification par une source de confiance externe,
                comme France Identité ou le futur portefeuille européen.
              </p>
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950">
                Fonctionnalité de démonstration : aucune vérification officielle n’est réalisée.
              </p>
            </div>
            <DemoIdentityVerificationButton />
          </div>
        </section>
      ) : null}

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
        )}
      </section>
    </main>
  );
}
