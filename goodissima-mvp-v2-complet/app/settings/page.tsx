export const dynamic = "force-dynamic";

import { unstable_noStore as noStore } from "next/cache";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { LogoutButton } from "@/components/LogoutButton";
import { PlatformNavigation } from "@/components/PlatformNavigation";
import { DashboardBackLink } from "@/components/DashboardBackLink";
import { isPrivateAccessMode } from "@/lib/access-invitations";
import { getCurrentPrismaUser } from "@/lib/auth";
import { getAIProviderLabel, getRuntimeEnvironmentLabel } from "@/lib/ai-runtime";
import { getI18n } from "@/lib/i18n";
import { defaultNotificationPreferences } from "@/lib/privacy";
import { prisma } from "@/lib/prisma";
import { humanizeAIEvent } from "@/lib/events/humanize";
import { SettingsPanel } from "./SettingsPanel";

const defaultMistralModel = "mistral-small-latest";
const mockModel = "scenario";

function getAIGovernanceProvider() {
  const requestedProvider = (process.env.AI_PROVIDER ?? "mock").toLowerCase();
  const mistralModel = process.env.MISTRAL_MODEL || defaultMistralModel;

  if (requestedProvider === "mistral" && process.env.MISTRAL_API_KEY) {
    return { provider: "mistral", model: mistralModel };
  }

  return { provider: "mock", model: mockModel };
}

async function countAIScenarios() {
  try {
    const scenarioDir = path.join(process.cwd(), "qa", "ai", "scenarios", "fixtures");
    const files = await readdir(scenarioDir);
    return files.filter((file) => file.endsWith(".json")).length;
  } catch {
    return 0;
  }
}

const aiPrinciples = [
  "L'IA suggere, l'humain decide.",
  "Aucune decision automatique.",
  "Aucune action automatique.",
  "Aucune donnee sensible inutile envoyee.",
  "Emails, tokens et URLs privees exclus.",
  "Actions IA auditees.",
];

const aiDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function SettingsPage() {
  noStore();

  const { t } = getI18n();
  const owner = await getCurrentPrismaUser();
  const organizationName = owner.name && owner.name !== owner.email ? owner.name : "Organisation Goodissima";
  const notificationPreferences = await prisma.userNotificationPreference.findUnique({
    where: { userId: owner.id },
  });
  const aiProvider = getAIGovernanceProvider();
  const environmentLabel = getRuntimeEnvironmentLabel();
  const aiProviderLabel = getAIProviderLabel();
  const [scenarioCount, recentAIEvents, accessInvitations] = await Promise.all([
    countAIScenarios(),
    prisma.aIEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        action: true,
        provider: true,
        model: true,
        status: true,
        createdAt: true,
        case: {
          select: {
            id: true,
            gLink: { select: { title: true } },
          },
        },
      },
    }),
    prisma.accessInvitation.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <DashboardBackLink className="mb-4" />
          <h1 className="text-3xl font-bold">{t("settings.title")}</h1>
          <p className="mt-1 text-slate-500">{t("settings.subtitle")}</p>
        </div>
        <LogoutButton />
      </div>

      <PlatformNavigation active="settings" organizationName={organizationName} />
      <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">IA & Gouvernance</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Centre de gouvernance IA</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
              Goodissima utilise l'IA comme copilote relationnel gouverne, privacy-first et human-in-the-loop.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-950 px-4 py-3 text-white">
            <p className="text-xs uppercase tracking-wide text-slate-400">Fournisseur actif</p>
            <p className="mt-1 text-sm font-semibold">{aiProvider.provider}</p>
            <p className="mt-1 text-xs text-slate-300">{aiProvider.model}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase text-slate-600">
            {environmentLabel}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase text-slate-600">
            {aiProviderLabel}
          </span>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-4">
            <div className="rounded-xl border bg-slate-50 p-4">
              <h3 className="font-semibold text-slate-900">Principes IA Goodissima</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                {aiPrinciples.map((principle) => (
                  <li key={principle} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                    <span>{principle}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border bg-slate-50 p-4">
              <h3 className="font-semibold text-slate-900">Tests QA IA</h3>
              <p className="mt-2 text-sm text-slate-600">
                {scenarioCount} scenario{scenarioCount > 1 ? "s" : ""} deterministe{scenarioCount > 1 ? "s" : ""}.
              </p>
              <p className="mt-3 rounded-lg bg-white px-3 py-2 font-mono text-xs text-slate-700 ring-1 ring-slate-200">
                npm.cmd run qa:ai:scenarios
              </p>
            </div>
          </div>

          <div className="rounded-xl border bg-slate-50 p-4">
            <h3 className="font-semibold text-slate-900">Journal IA recent</h3>
            <div className="mt-3 max-h-96 space-y-2 overflow-y-auto pr-1">
              {recentAIEvents.length === 0 ? (
                <p className="rounded-lg bg-white p-3 text-sm text-slate-500 ring-1 ring-slate-200">
                  Aucun evenement IA recent.
                </p>
              ) : null}
              {recentAIEvents.map((event) => (
                <article key={event.id} className="rounded-lg bg-white p-3 text-sm ring-1 ring-slate-200">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{humanizeAIEvent(event.action).title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {humanizeAIEvent(event.action).category ?? "IA"} - {event.provider} / {event.model ?? "modele non renseigne"} - {event.status}
                      </p>
                      {event.case ? (
                        <p className="mt-1 text-xs text-slate-500">
                          Dossier: {event.case.gLink.title}
                        </p>
                      ) : null}
                    </div>
                    <time className="shrink-0 text-xs text-slate-500">
                      {aiDateFormatter.format(event.createdAt)}
                    </time>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
      <SettingsPanel
        organizationName={organizationName}
        initialNotificationPreferences={notificationPreferences ?? defaultNotificationPreferences}
        privateAccessMode={isPrivateAccessMode()}
        initialAccessInvitations={accessInvitations.map((invitation) => ({
          id: invitation.id,
          email: invitation.email,
          status: invitation.status,
          note: invitation.note,
          expiresAt: invitation.expiresAt?.toISOString() ?? null,
          acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
          createdAt: invitation.createdAt.toISOString(),
        }))}
      />
    </main>
  );
}
