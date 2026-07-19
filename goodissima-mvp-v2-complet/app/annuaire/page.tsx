export const dynamic = "force-dynamic";

import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { DashboardBackLink } from "@/components/DashboardBackLink";
import { LogoutButton } from "@/components/LogoutButton";
import { PlatformNavigation } from "@/components/PlatformNavigation";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const v1States = [
  { label: "Contacts globaux", value: "non activés" },
  { label: "Organisations réutilisables", value: "non activées comme annuaire" },
  { label: "Identité Goodissima", value: "disponible via l’espace identité" },
  { label: "Invitations automatiques", value: "non activées" },
  { label: "Accès automatique", value: "non activé" },
];

const notEnabledItems = [
  "création de contacts globaux",
  "carnet d’adresses réutilisable",
  "rattachement automatique d’un participant de parcours à un contact",
  "invitation depuis l’annuaire",
  "accès partagé depuis l’annuaire",
];

const recommendedUses = [
  "utiliser le cockpit gouvernance pour les participants d’un parcours",
  "utiliser /identity pour gérer l’identité Goodissima",
  "considérer /annuaire comme espace de préparation transversal",
];

function identityStatusLabel(status: string | undefined) {
  if (status === "VERIFIED") return "vérifiée";
  if (status === "SUSPENDED") return "suspendue";
  if (status === "REVOKED") return "révoquée";
  if (status === "UNVERIFIED") return "non vérifiée";
  return "non liée";
}

export default async function DirectoryPage() {
  noStore();

  const currentUser = await getCurrentPrismaUser();
  const organizationName =
    currentUser.name && currentUser.name !== currentUser.email
      ? currentUser.name
      : "Organisation Goodissima";
  const identity = currentUser.goodissimaIdentityId
    ? await prisma.goodissimaIdentity.findUnique({
        where: { id: currentUser.goodissimaIdentityId },
        select: {
          id: true,
          status: true,
          type: true,
          createdAt: true,
        },
      })
    : null;
  const identityLinked = Boolean(identity);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <DashboardBackLink className="mb-4" />
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Brique transversale V1
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Annuaire Goodissima</h1>
          <p className="mt-2 max-w-3xl text-slate-500">
            Identités, organisations et contacts de confiance — V1 honnête
          </p>
        </div>
        <LogoutButton />
      </div>

      <PlatformNavigation active="directory" organizationName={organizationName} />

      <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <p className="text-sm font-semibold text-amber-950">
          V1 : cet annuaire ne crée aucun contact global, n’envoie aucune invitation, n’ouvre aucun accès et ne notifie
          personne automatiquement.
        </p>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">État V1</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Capacités disponibles</h2>
          </div>
          <span className="self-start rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            Informatif uniquement
          </span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          {v1States.map((item) => (
            <article key={item.label} className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{item.value}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Aujourd’hui</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Ce qui existe aujourd’hui</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              L’identité Goodissima représente votre identité de confiance. L’annuaire transversal de contacts reste un
              espace de préparation, sans carnet d’adresses global activé.
            </p>
          </div>
          <span
            className={
              identityLinked
                ? "self-start rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200"
                : "self-start rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200"
            }
          >
            Identité {identityLinked ? "liée" : "non liée"}
          </span>
        </div>

        <div data-boussole-id="directory-identity" className="mt-5 rounded-xl border bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-950">Identité Goodissima de l’utilisateur</p>
          <p className="mt-2 text-sm text-slate-600">
            Statut : {identityLinked ? `liée, ${identityStatusLabel(identity?.status)}` : "non liée"}
          </p>
          {identity ? (
            <p className="mt-1 text-sm text-slate-600">
              Type : {identity.type === "PERSON" ? "personnelle" : "organisation"}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/gouvernance" className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-slate-700">
              Ouvrir la gouvernance
            </Link>
            <Link href="/identity" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              Ouvrir l’espace identité
            </Link>
            <Link
              href="/trust/connectors"
              className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Voir les connecteurs de confiance
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Limites</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">Ce qui n’est pas encore activé</h2>
          <ul className="mt-4 space-y-3">
            {notEnabledItems.map((item) => (
              <li key={item} className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">V1</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">Usage recommandé V1</h2>
          <ul className="mt-4 space-y-3">
            {recommendedUses.map((item) => (
              <li key={item} className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
