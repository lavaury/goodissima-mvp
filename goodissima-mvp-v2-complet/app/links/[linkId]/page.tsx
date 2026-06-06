export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { DashboardBackLink } from "@/components/DashboardBackLink";
import { DebugCreateTestCaseButton } from "@/components/DebugCreateTestCaseButton";
import { LogoutButton } from "@/components/LogoutButton";
import { PlatformNavigation } from "@/components/PlatformNavigation";
import { StatusBadge } from "@/components/StatusBadge";
import { VerifiedAdmissionLinkPanel } from "@/components/VerifiedAdmissionLinkPanel";
import { getCurrentPrismaUser } from "@/lib/auth";
import { isGoodissimaDebugMode } from "@/lib/debug";
import type { ConditionalRule } from "@/lib/form-rules";
import { getFormFields } from "@/lib/forms";
import { getI18n } from "@/lib/i18n";
import { DEFAULT_RELATION_TEMPLATE_KEY } from "@/lib/relation-templates";
import {
  localizeDefaultSecureConversationFields,
  localizeTemplateName,
} from "@/lib/template-localization";
import {
  getActiveTemplateVersion,
  parseTemplateSnapshot,
  snapshotFieldsToDynamicFields,
} from "@/lib/template-snapshots";
import { prisma } from "@/lib/prisma";

type FieldOption = {
  label: string;
  value: string;
};

function parseFieldOptions(options: unknown): FieldOption[] {
  if (!Array.isArray(options)) return [];

  return options
    .map((option) => {
      if (!option || typeof option !== "object") return null;

      const { label, value } = option as { label?: unknown; value?: unknown };
      if (typeof label !== "string" || typeof value !== "string") return null;

      return { label, value };
    })
    .filter((option): option is FieldOption => Boolean(option));
}

function parseConditionalRules(rules: unknown): ConditionalRule[] {
  if (!Array.isArray(rules)) return [];

  return rules
    .map((rule) => {
      if (!rule || typeof rule !== "object") return null;

      const { field, operator, value, action } = rule as Record<string, unknown>;
      if (typeof field !== "string" || typeof operator !== "string" || typeof action !== "string") return null;
      if (!["equals", "notEquals", "greaterThan", "exists"].includes(operator)) return null;
      if (!["SHOW", "HIDE", "REQUIRE", "DISABLE"].includes(action)) return null;

      return {
        field,
        operator,
        value: typeof value === "string" || typeof value === "boolean" || typeof value === "number" ? value : null,
        action,
      } as ConditionalRule;
    })
    .filter((rule): rule is ConditionalRule => Boolean(rule));
}

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function LinkCreatedPage({ params }: { params: { linkId: string } }) {
  noStore();

  const owner = await getCurrentPrismaUser();
  const { locale, t } = getI18n();
  const link = await prisma.gLink.findFirst({
    where: { id: params.linkId, ownerId: owner.id },
    include: {
      template: true,
      templateVersion: true,
      cases: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          candidateAccessToken: true,
          candidateName: true,
          candidateEmail: true,
          candidateEmailNotificationsEnabled: true,
          createdAt: true,
          status: true,
          governanceStatus: true,
          _count: {
            select: {
              messages: true,
              documents: true,
            },
          },
        },
      },
    },
  });

  if (!link) notFound();

  const activeFallbackVersion =
    !link.templateVersion && link.templateId ? await getActiveTemplateVersion(link.templateId) : null;
  const snapshot = link.templateVersion
    ? parseTemplateSnapshot(link.templateVersion.snapshot)
    : activeFallbackVersion
      ? parseTemplateSnapshot(activeFallbackVersion.snapshot)
      : null;
  const formTemplate = snapshot
    ? null
    : link.templateId
      ? await prisma.formTemplate.findFirst({
          where: { relationTemplateId: link.templateId },
          orderBy: { createdAt: "asc" },
        })
      : null;
  const rawFields = snapshot
    ? snapshotFieldsToDynamicFields(snapshot)
    : formTemplate
      ? (await getFormFields(formTemplate.id)).map((field) => ({
          key: field.key,
          label: field.label,
          type: field.type.toUpperCase(),
          required: field.required,
          placeholder: field.placeholder,
          defaultValue: field.defaultValue,
          step: field.step,
          options: parseFieldOptions(field.options),
          conditionalRules: parseConditionalRules(field.conditionalRules),
        }))
      : [];
  const fields =
    link.template?.key === DEFAULT_RELATION_TEMPLATE_KEY
      ? localizeDefaultSecureConversationFields(rawFields, locale)
      : rawFields;
  const steps = Array.from(new Set(fields.map((field) => field.step || 1)))
    .sort((a, b) => a - b)
    .map((step) => ({
      step,
      fields: fields.filter((field) => (field.step || 1) === step),
    }));
  const publicPath = `/l/${link.slug}`;
  const publicUrl = `${getAppUrl()}${publicPath}`;
  const templateName = link.template
    ? localizeTemplateName(link.template.key, link.template.name, locale)
    : t("studio.noActiveVersion");
  const debugMode = isGoodissimaDebugMode();
  const secureToken = link.cases[0]?.candidateAccessToken ?? null;
  const showVerifiedAdmissionLinkPanel =
    process.env.TRUST_ADMISSION_VERIFIED_LINK_UI_ENABLED === "true";

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <DashboardBackLink className="mb-4" />
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            {t("links.created.eyebrow")}
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">{t("links.created.title")}</h1>
          <p className="mt-2 max-w-2xl text-slate-500">{t("links.created.subtitle")}</p>
        </div>
        <LogoutButton />
      </div>

      <PlatformNavigation
        active="relations"
        organizationName={owner.name && owner.name !== owner.email ? owner.name : "Organisation Goodissima"}
      />

      <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-700">{t("links.created.publicCandidateLink")}</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              value={publicUrl}
              readOnly
              className="min-h-11 w-full rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-800"
            />
            <CopyLinkButton value={publicUrl} />
          </div>
          <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-emerald-200">
            {t("links.created.education")}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-700">{t("links.created.conversationStatus")}</p>
          <div className="mt-3 rounded-xl bg-slate-50 p-4">
            <p className="font-semibold text-slate-950">{t("links.created.noActiveConversation")}</p>
            <p className="mt-1 text-sm text-slate-500">{t("links.created.noActiveConversationHelp")}</p>
          </div>
        </div>
      </section>

      {showVerifiedAdmissionLinkPanel ? (
        <VerifiedAdmissionLinkPanel gLinkId={link.id} />
      ) : null}

      {debugMode ? (
        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-800">Debug</p>
          <div className="mt-3 space-y-2 text-sm text-amber-950">
            <p>
              Lien public candidat:{" "}
              <Link href={publicPath} className="font-medium underline" prefetch={false}>
                {publicPath}
              </Link>
            </p>
            {secureToken ? (
              <p>
                Lien secure:{" "}
                <Link href={`/secure/${secureToken}`} className="font-medium underline" prefetch={false}>
                  /secure/{secureToken}
                </Link>
              </p>
            ) : (
              <p>Aucun lien secure genere tant que le candidat n'a pas soumis le formulaire</p>
            )}
          </div>
          <div className="mt-4">
            <DebugCreateTestCaseButton linkId={link.id} />
          </div>
        </section>
      ) : null}

      <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Reponses recues</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Dossiers issus de ce lien</h2>
            <p className="mt-1 text-sm text-slate-500">Chaque candidat dispose de son propre dossier.</p>
          </div>
          <span className="self-start rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {link.cases.length} dossier{link.cases.length > 1 ? "s" : ""}
          </span>
        </div>

        {link.cases.length === 0 ? (
          <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Aucun dossier pour ce lien.</p>
        ) : (
          <div className="mt-5 overflow-hidden rounded-xl border">
            <div className="hidden grid-cols-[1.5fr_1.6fr_1fr_1fr_1fr_1fr_auto] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:grid">
              <span>Candidat</span>
              <span>Email</span>
              <span>Date</span>
              <span>Statut</span>
              <span>Gouvernance</span>
              <span>Activite</span>
              <span className="text-right">Action</span>
            </div>
            <div className="divide-y">
              {link.cases.map((relationCase) => {
                const candidateEmail =
                  relationCase.candidateEmailNotificationsEnabled ||
                  relationCase.candidateEmail.endsWith("@goodissima.local")
                    ? "Canal prive"
                    : relationCase.candidateEmail;

                return (
                  <div
                    key={relationCase.id}
                    className="grid gap-3 px-4 py-4 text-sm lg:grid-cols-[1.5fr_1.6fr_1fr_1fr_1fr_1fr_auto] lg:items-center"
                  >
                    <div>
                      <p className="font-medium text-slate-950">{relationCase.candidateName}</p>
                      <p className="mt-1 text-xs text-slate-500 lg:hidden">{candidateEmail}</p>
                    </div>
                    <p className="hidden break-all text-slate-600 lg:block">{candidateEmail}</p>
                    <p className="text-slate-600">{formatDateTime(relationCase.createdAt)}</p>
                    <div>
                      <StatusBadge status={relationCase.status} />
                    </div>
                    <div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                        {relationCase.governanceStatus}
                      </span>
                    </div>
                    <p className="text-slate-600">
                      {relationCase._count.messages} message{relationCase._count.messages > 1 ? "s" : ""} -{" "}
                      {relationCase._count.documents} document{relationCase._count.documents > 1 ? "s" : ""}
                    </p>
                    <Link
                      href={`/cases/${relationCase.id}?refresh=1`}
                      prefetch={false}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-center text-sm font-medium text-white"
                    >
                      Ouvrir le dossier
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              {t("links.created.previewEyebrow")}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">{link.title}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {templateName}
              {link.templateVersion ? ` - v${link.templateVersion.version}` : ""}
            </p>
          </div>
          <span className="self-start rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {t("links.created.readOnly")}
          </span>
        </div>

        {steps.length === 0 ? (
          <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            {t("links.new.noPublishedField")}
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            {steps.map((step) => (
              <div key={step.step} className="rounded-xl border bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("studio.step")} {step.step}
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {step.fields.map((field) => (
                    <div key={field.key} className="rounded-xl border bg-white p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-slate-900">{field.label}</p>
                        {field.required ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                            {t("links.created.required")}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{field.type}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link
          href={publicPath}
          prefetch={false}
          className="rounded-2xl bg-slate-900 px-5 py-3 text-center text-sm font-medium text-white"
        >
          {t("links.created.testCandidate")}
        </Link>
        <Link
          href={`/dashboard?refresh=${encodeURIComponent(link.id)}`}
          prefetch={false}
          className="rounded-2xl border px-5 py-3 text-center text-sm font-medium text-slate-700"
        >
          ← Retour au Dashboard
        </Link>
      </div>
    </main>
  );
}
