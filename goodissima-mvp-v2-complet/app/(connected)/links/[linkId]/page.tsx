export const dynamic = "force-dynamic";

import Link from "next/link";
import { PageNavigationContext } from "@/components/SpatialNavigationContext";
import { navigationWorkspaceSelect } from "@/lib/spatial-navigation";
import { notFound, redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { HistoryBackButton } from "@/components/HistoryBackButton";
import { DebugCreateTestCaseButton } from "@/components/DebugCreateTestCaseButton";
import { LinkAdmissionPanel } from "@/components/LinkAdmissionPanel";
import { StatusBadge } from "@/components/StatusBadge";
import { GLinkMatchingPanel } from "@/components/GLinkMatchingPanel";
import { SimpleLinkOwnerControls } from "@/components/SimpleLinkOwnerControls";
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
import { buildPublicAppUrl } from "@/lib/public-app-url";
import { parseGLinkMatchingState } from "@/lib/glink-matching";
import { linkObjectLabel } from "@/lib/object-creation";
import { isAutonomousModernOpportunity } from "@/lib/opportunities/opportunity-projection";

type FieldOption = {
  label: string;
  value: string;
};

type TrustLevel = "VERIFIED" | "IDENTIFIED" | "UNKNOWN";

const VERIFIED_IDENTITY = "VERIFIED_IDENTITY";

type CandidateIdentityForTrustLevel = {
  credentials: Array<{
    credentialType: {
      code: string;
    };
  }>;
} | null;

const trustLevelDisplay: Record<TrustLevel, { label: string; className: string; dotClassName: string }> = {
  VERIFIED: {
    label: "Vérifié",
    className: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    dotClassName: "bg-emerald-500",
  },
  IDENTIFIED: {
    label: "Identifié",
    className: "bg-amber-50 text-amber-800 ring-amber-200",
    dotClassName: "bg-amber-400",
  },
  UNKNOWN: {
    label: "Non vérifié",
    className: "bg-slate-100 text-slate-700 ring-slate-200",
    dotClassName: "bg-slate-400",
  },
};

function getTrustLevel(candidateIdentity: CandidateIdentityForTrustLevel): TrustLevel {
  const activeCredentials = candidateIdentity?.credentials ?? [];

  if (activeCredentials.length === 0) return "UNKNOWN";

  return activeCredentials.some((credential) => credential.credentialType.code === VERIFIED_IDENTITY)
    ? "VERIFIED"
    : "IDENTIFIED";
}

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

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function LinkCreatedPage({ params }: { params: { linkId: string } }) {
  noStore();

  const owner = await getCurrentPrismaUser();
  const now = new Date();
  const { locale, t } = getI18n();
  const link = await prisma.gLink.findFirst({
    where: { id: params.linkId, ownerId: owner.id },
    include: {
      workspace: { select: navigationWorkspaceSelect },
      template: true,
      templateVersion: true,
      cases: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          candidateName: true,
          candidateEmail: true,
          candidateEmailNotificationsEnabled: true,
          createdAt: true,
          status: true,
          governanceStatus: true,
          candidateIdentity: {
            select: {
              credentials: {
                where: {
                  status: "ACTIVE",
                  OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
                },
                select: {
                  credentialType: {
                    select: {
                      code: true,
                    },
                  },
                },
              },
            },
          },
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
  if (isAutonomousModernOpportunity(link)) {
    redirect(`/opportunities/${encodeURIComponent(link.id)}`);
  }

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
          validationRules: field.validationRules,
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
  const publicUrl = buildPublicAppUrl(publicPath);
  const isDraft = link.status === "DRAFT";
  const templateName = link.template
    ? localizeTemplateName(link.template.key, link.template.name, locale)
    : t("studio.noActiveVersion");
  const debugMode = isGoodissimaDebugMode();
  const gLinkMatchingState = parseGLinkMatchingState(link.rules);
  const objectLabel = linkObjectLabel(link.rules);
  const status = link.status === "ACTIVE" ? { label: "Actif", style: "bg-emerald-100 text-emerald-800" } : link.status === "DISABLED" ? { label: "Suspendu", style: "bg-amber-100 text-amber-900" } : link.status === "EXPIRED" ? { label: "Expiré", style: "bg-slate-200 text-slate-700" } : { label: "Archivé", style: "bg-slate-200 text-slate-700" };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageNavigationContext pathname={`/links/${encodeURIComponent(link.id)}`} items={[{ label: "Accueil", href: "/dashboard" }, { label: "Mes espaces", href: "/spaces" }, { label: link.title }]} />
      <HistoryBackButton />
      <header className="mt-4">
        <p className="text-sm font-bold uppercase tracking-wider text-[#247f88]">{objectLabel}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-bold text-slate-950">{link.title}</h1><span className={`rounded-full px-3 py-1 text-sm font-semibold ${status.style}`}>{status.label}</span></div>
        {link.description ? <p className="mt-3 max-w-2xl text-slate-600">{link.description}</p> : null}
      </header>

      {isDraft ? <p className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 font-semibold text-amber-900">Brouillon — non publié. Aucun lien public, partage ou accès candidat n’est disponible.</p> : <><section data-boussole-id="simple-link-sharing" className="mt-8 rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold">Partage</h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row"><input value={publicUrl} readOnly aria-label="Adresse publique" className="min-h-11 w-full rounded-xl border bg-slate-50 px-3 text-sm" /><span data-boussole-id="copy-public-link"><CopyLinkButton value={publicUrl} /></span></div>
        <div className="mt-4"><SimpleLinkOwnerControls linkId={link.id} publicUrl={publicUrl} status={link.status} /></div>
      </section>

      <details data-boussole-id="simple-link-access" className="mt-5 rounded-2xl border bg-white p-5 shadow-sm"><summary className="cursor-pointer font-semibold">Accès · {link.admissionMode === "OPEN" ? "Ouvert à tous" : "Identité vérifiée requise"}</summary><div data-boussole-id="explain-link-admission"><LinkAdmissionPanel linkId={link.id} initialMode={link.admissionMode} /></div></details>

      {gLinkMatchingState.enabled ? <details className="mt-5 rounded-2xl border bg-white p-5"><summary className="cursor-pointer font-semibold text-slate-700">Fonctions historiques</summary><GLinkMatchingPanel linkId={link.id} criteriaSufficient initialEnabled /></details> : null}</>}

      {debugMode && link.status !== "ARCHIVED" ? (
        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-800">Debug</p>
          <div className="mt-3 space-y-2 text-sm text-amber-950">
            <p>
              Lien public candidat:{" "}
              <Link href={publicPath} className="font-medium underline" prefetch={false}>
                {publicPath}
              </Link>
            </p>
            <p>Les liens candidats securises sont disponibles dans chaque dossier disposant d'un acces actif.</p>
          </div>
          <div className="mt-4">
            <DebugCreateTestCaseButton linkId={link.id} />
          </div>
        </section>
      ) : null}

      <section data-boussole-id="simple-link-responses" className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Réponses</h2>
            <p className="mt-1 text-sm text-slate-500">Consultez les réponses envoyées depuis ce formulaire.</p>
          </div>
          <span className="self-start rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {link.cases.length} réponse{link.cases.length > 1 ? "s" : ""}
          </span>
        </div>

        {link.cases.length === 0 ? (
          <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Aucune réponse pour le moment.</p>
        ) : (
          <div className="mt-5 overflow-hidden rounded-xl border">
            <div className="hidden grid-cols-[1.35fr_1.4fr_0.95fr_0.9fr_1fr_1fr_1.1fr_auto] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:grid">
              <span>Candidat</span>
              <span>Email</span>
              <span>Date</span>
              <span>Statut</span>
              <span>Gouvernance</span>
              <span>Confiance</span>
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
                const trustLevel = getTrustLevel(relationCase.candidateIdentity);
                const trustDisplay = trustLevelDisplay[trustLevel];

                return (
                  <div
                    key={relationCase.id}
                    className="grid gap-3 px-4 py-4 text-sm lg:grid-cols-[1.35fr_1.4fr_0.95fr_0.9fr_1fr_1fr_1.1fr_auto] lg:items-center"
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
                    <div>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ${trustDisplay.className}`}
                      >
                        <span className={`h-2 w-2 rounded-full ${trustDisplay.dotClassName}`} aria-hidden="true" />
                        {trustDisplay.label}
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

      <details data-boussole-id="simple-link-form" className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
        <summary className="cursor-pointer text-xl font-semibold text-slate-950">Détail du formulaire · {fields.length} champ{fields.length > 1 ? "s" : ""}</summary>
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
      </details>

      {!isDraft ? <div className="mt-6"><Link
          href={publicPath}
          data-boussole-id="open-public-link"
          prefetch={false}
          className="rounded-2xl bg-slate-900 px-5 py-3 text-center text-sm font-medium text-white"
        >
          {t("links.created.testCandidate")}
        </Link></div> : null}
    </main>
  );
}
