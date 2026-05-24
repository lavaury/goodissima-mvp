import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { activeCandidateAccessWhere } from "@/lib/candidate-access";
import type { ConditionalRule } from "@/lib/form-rules";
import { getFormFields } from "@/lib/forms";
import { getI18n } from "@/lib/i18n";
import { getRelationTemplateForLink } from "@/lib/relation-templates";
import {
  getDefaultSecureConversationCopy,
  localizeDefaultSecureConversationFields,
} from "@/lib/template-localization";
import {
  parseTemplateSnapshot,
  snapshotFieldsToDynamicFields,
  getActiveTemplateVersion,
} from "@/lib/template-snapshots";
import { prisma } from "@/lib/prisma";
import CandidateForm from "./candidate-form";

type FieldOption = {
  label: string;
  value: string;
};

const defaultFields = [
  {
    key: "fullName",
    label: "Nom complet",
    type: "TEXT",
    required: true,
    placeholder: "Votre nom",
    defaultValue: null,
    step: 1,
    options: [],
    conditionalRules: [],
  },
  {
    key: "email",
    label: "Email",
    type: "EMAIL",
    required: true,
    placeholder: "Votre email",
    defaultValue: null,
    step: 1,
    options: [],
    conditionalRules: [],
  },
  {
    key: "message",
    label: "Message",
    type: "TEXTAREA",
    required: true,
    placeholder: "Presentez-vous et indiquez votre demande",
    defaultValue: null,
    step: 1,
    options: [],
    conditionalRules: [],
  },
];

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
      if (typeof field !== "string" || typeof operator !== "string" || typeof action !== "string") {
        return null;
      }

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

export default async function PublicLinkPage({ params }: { params: { slug: string } }) {
  const { locale } = getI18n();
  const link = await prisma.gLink.findUnique({
    where: { slug: params.slug },
    include: { owner: true, template: true, templateVersion: true },
  });

  if (!link || link.status !== "ACTIVE") notFound();

  const candidateCookie = cookies().get(`goodissima_candidate_${link.id}`)?.value;

  if (candidateCookie) {
    const existingCase = await prisma.relationCase.findFirst({
      where: {
        ...activeCandidateAccessWhere(candidateCookie),
        gLinkId: link.id,
      },
      select: { candidateAccessToken: true },
    });

    if (existingCase) {
      redirect(`/secure/${encodeURIComponent(existingCase.candidateAccessToken)}`);
    }
  }

  const relationTemplate = link.template ?? (await getRelationTemplateForLink(null));
  const activeFallbackVersion =
    !link.templateVersion && relationTemplate ? await getActiveTemplateVersion(relationTemplate.id) : null;
  const snapshot = link.templateVersion
    ? parseTemplateSnapshot(link.templateVersion.snapshot)
    : activeFallbackVersion
      ? parseTemplateSnapshot(activeFallbackVersion.snapshot)
      : null;
  const templateKey = snapshot?.relationTemplate.key ?? relationTemplate?.key ?? null;
  const formTemplate = snapshot
    ? { id: snapshot.formTemplate.id }
    : relationTemplate
      ? await prisma.formTemplate.findFirst({
          where: { relationTemplateId: relationTemplate.id },
          orderBy: { createdAt: "asc" },
        })
      : null;
  const formFields = !snapshot && formTemplate ? await getFormFields(formTemplate.id) : [];
  const candidateFieldsSource = snapshot
    ? snapshotFieldsToDynamicFields(snapshot)
    : formFields.length
      ? formFields.map((field) => ({
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
      : defaultFields;
  const candidateFields =
    templateKey === "DEFAULT_SECURE_CONVERSATION"
      ? localizeDefaultSecureConversationFields(candidateFieldsSource, locale)
      : candidateFieldsSource;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {getDefaultSecureConversationCopy("publicEyebrow", locale)}
        </p>
      </div>

      <div className="rounded-3xl border bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          {getDefaultSecureConversationCopy("contactEyebrow", locale)}
        </p>

        <h1 className="mt-3 text-3xl font-bold">{link.title}</h1>

        {link.city && <p className="mt-1 text-slate-500">{link.city}</p>}
        {link.description && <p className="mt-5 text-slate-700">{link.description}</p>}

        <div className="mt-8 rounded-2xl bg-slate-50 p-5">
          <h2 className="font-semibold">{getDefaultSecureConversationCopy("onboardingTitle", locale)}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {getDefaultSecureConversationCopy("onboardingText", locale)}
          </p>
        </div>

        <CandidateForm
          gLinkId={link.id}
          formTemplateId={formTemplate?.id ?? null}
          fields={candidateFields}
          copy={{
            documentOptionalTitle: getDefaultSecureConversationCopy("documentOptionalTitle", locale),
            documentOptionalHelp: getDefaultSecureConversationCopy("documentOptionalHelp", locale),
            documentNamePlaceholder: getDefaultSecureConversationCopy("documentNamePlaceholder", locale),
            documentUrlPlaceholder: getDefaultSecureConversationCopy("documentUrlPlaceholder", locale),
            notificationConsentTitle: getDefaultSecureConversationCopy("notificationConsentTitle", locale),
            notificationConsentHelp: getDefaultSecureConversationCopy("notificationConsentHelp", locale),
            notificationEmailLabel: getDefaultSecureConversationCopy("notificationEmailLabel", locale),
            notificationEmailHelp: getDefaultSecureConversationCopy("notificationEmailHelp", locale),
            notificationEmailPlaceholder: getDefaultSecureConversationCopy("notificationEmailPlaceholder", locale),
            submit: getDefaultSecureConversationCopy("submit", locale),
            submitting: getDefaultSecureConversationCopy("submitting", locale),
            next: getDefaultSecureConversationCopy("next", locale),
            back: getDefaultSecureConversationCopy("back", locale),
            stepProgress: getDefaultSecureConversationCopy("stepProgress", locale),
            messageSentToast: getDefaultSecureConversationCopy("messageSentToast", locale),
            fieldErrorToast: getDefaultSecureConversationCopy("fieldErrorToast", locale),
          }}
        />
      </div>
    </main>
  );
}
