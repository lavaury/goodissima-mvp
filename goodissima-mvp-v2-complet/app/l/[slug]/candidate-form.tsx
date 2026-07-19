"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import {
  DynamicFormRenderer,
  createInitialDynamicValues,
  getStringFieldValue,
  supportedFieldTypes,
  toRuleValues,
  type DynamicFieldValue,
  type DynamicFormField,
} from "@/components/DynamicFormRenderer";
import { deriveCandidateSubmissionFields } from "@/lib/candidate-form-safety";
import { getFieldsForStep, getStepCount } from "@/lib/form-steps";
import { isFieldDisabled, isFieldRequired, shouldDisplayField } from "@/lib/form-rules";
import {
  SECURE_LINK_ADMISSION_LABELS,
  type SecureLinkAdmissionMode,
} from "@/lib/secure-link-admission";
import { describeSimpleFieldRule, evaluateSimpleFieldRule, parseSimpleFieldRule } from "@/lib/simple-field-rules";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const privateFieldKeys = new Set(["notificationEmail"]);
const trustAdmissionBlockedCode = "TRUST_ADMISSION_BLOCKED";
const trustAdmissionBlockedMessage =
  "Cette relation nécessite une attestation valide. Elle peut être absente, expirée ou révoquée.";

async function getApiErrorMessage(res: Response) {
  try {
    const body = await res.json();
    const message = typeof body.error === "string" ? body.error : "Erreur lors de l'ajout du document";
    const stage = typeof body.stage === "string" ? body.stage : null;
    const code = typeof body.code === "string" ? body.code : null;
    return [stage ? `Etape ${stage}` : null, code, message].filter(Boolean).join(" - ");
  } catch {
    return "Erreur lors de l'ajout du document";
  }
}

function normalizeAnswerKey(key: string) {
  return key
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getFirstAnswer(answers: Record<string, DynamicFieldValue>, keys: string[]) {
  const normalizedAnswers = new Map(
    Object.entries(answers).map(([key, value]) => [normalizeAnswerKey(key), value]),
  );

  for (const key of keys) {
    const value = getStringFieldValue(
      answers[key] ?? normalizedAnswers.get(normalizeAnswerKey(key)),
    ).trim();
    if (value) return value;
  }

  return "";
}

async function getCaseSubmissionError(res: Response) {
  try {
    const body = await res.json();
    const code = body && typeof body === "object" && "code" in body && typeof body.code === "string"
      ? body.code
      : null;

    if (code === trustAdmissionBlockedCode) {
      return { code: trustAdmissionBlockedCode, message: trustAdmissionBlockedMessage };
    }

    if (typeof body.error === "string") {
      return { code, message: body.error };
    }

    if (code) {
      return { code, message: "La demande n'a pas pu être envoyée. Vérifiez les champs du formulaire." };
    }
  } catch {
    // Keep the generic candidate-facing fallback when the API response is not JSON.
  }

  return { code: null, message: "Erreur lors de l'action" };
}

export default function CandidateForm({
  gLinkId,
  admissionMode,
  formTemplateId,
  templateVersionId,
  fields,
  copy,
}: {
  gLinkId: string;
  admissionMode: SecureLinkAdmissionMode;
  formTemplateId: string | null;
  templateVersionId?: string | null;
  fields: DynamicFormField[];
  copy: {
    documentOptionalTitle: string;
    documentOptionalHelp: string;
    documentNamePlaceholder: string;
    documentUrlPlaceholder: string;
    notificationConsentTitle: string;
    notificationConsentHelp: string;
    notificationEmailLabel: string;
    notificationEmailHelp: string;
    notificationEmailPlaceholder: string;
    submit: string;
    submitting: string;
    next: string;
    back: string;
    stepProgress: string;
    messageSentToast: string;
    fieldErrorToast: string;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState<Record<string, DynamicFieldValue>>(() =>
    createInitialDynamicValues(fields),
  );
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [currentStep, setCurrentStep] = useState(1);
  const [documentFields, setDocumentFields] = useState({
    documentName: "",
    documentUrl: "",
  });
  const [emailNotificationsConsent, setEmailNotificationsConsent] = useState(false);
  const [notificationEmail, setNotificationEmail] = useState("");
  const [admissionErrorMessage, setAdmissionErrorMessage] = useState("");
  const [isAdmissionBlocked, setIsAdmissionBlocked] = useState(false);
  const stepCount = getStepCount(fields);
  const isMultiStep = stepCount > 1;
  const currentFields = isMultiStep ? getFieldsForStep(fields, currentStep) : fields;
  const hasTemplateNotificationFields = fields.some((field) =>
    ["notificationOptIn", "notificationEmail"].includes(field.key),
  );
  const trustAdmissionToken = searchParams.get("trustAdmissionToken")?.trim() ?? "";
  const search = searchParams.toString();
  const returnPath = `${pathname}${search ? `?${search}` : ""}`;
  const authNext = encodeURIComponent(returnPath);

  function validateFields(fieldsToValidate: DynamicFormField[]) {
    const ruleValues = toRuleValues(answers);

    for (const field of fieldsToValidate.filter(
      (item) =>
        supportedFieldTypes.has(item.type) &&
        shouldDisplayField(item, ruleValues) &&
        !isFieldDisabled(item, ruleValues),
    )) {
      const value = answers[field.key];
      const stringValue = getStringFieldValue(value).trim();

      if (isFieldRequired(field, ruleValues)) {
        const missingValue =
          field.type === "CHECKBOX"
            ? value !== true
            : field.type === "FILE"
              ? !files[field.key]
              : !stringValue;

        if (missingValue) return false;
      }

      if (field.type === "EMAIL" && stringValue && !emailPattern.test(stringValue)) {
        return false;
      }

      if (field.type === "NUMBER" && stringValue && Number.isNaN(Number(stringValue))) {
        return false;
      }
    }

    return true;
  }

  function validateForm() {
    if (!validateFields(fields)) return false;

    const templateNotificationOptIn = answers.notificationOptIn === true;
    const wantsNotifications = hasTemplateNotificationFields
      ? templateNotificationOptIn
      : emailNotificationsConsent;

    if (wantsNotifications) {
      const value = (
        hasTemplateNotificationFields ? getStringFieldValue(answers.notificationEmail) : notificationEmail
      ).trim();
      return Boolean(value && emailPattern.test(value));
    }

    return true;
  }

  function getRuleIssues() {
    return fields.flatMap((field) => {
      const rule = parseSimpleFieldRule(field.validationRules);
      if (!rule || field.type === "SECTION") return [];
      const result = evaluateSimpleFieldRule(answers[field.key], rule);
      if (result.valid) return [];
      return [{ field, rule, message: describeSimpleFieldRule(field) }];
    });
  }

  function goToNextStep() {
    if (!validateFields(currentFields)) {
      toast.error(copy.fieldErrorToast);
      return;
    }

    setCurrentStep(Math.min(currentStep + 1, stepCount));
  }

  async function uploadFormFiles(candidateAccessToken: string) {
    const fileEntries = Object.entries(files).filter((entry): entry is [string, File] =>
      Boolean(entry[1]),
    );

    for (const [, file] of fileEntries) {
      const formData = new FormData();
      formData.append("candidateAccessToken", candidateAccessToken);
      formData.append("file", file);

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res));
      }
    }
  }

  async function submit() {
    if (!validateForm()) {
      setAdmissionErrorMessage("");
      setIsAdmissionBlocked(false);
      toast.error(copy.fieldErrorToast);
      return;
    }
    const ruleIssues = getRuleIssues();
    const blockingIssue = ruleIssues.find((issue) => issue.rule.mode === "BLOCKING");
    if (blockingIssue) {
      const message = `${blockingIssue.message}. Corrigez cette réponse avant l’envoi.`;
      setAdmissionErrorMessage(message);
      toast.error(message);
      return;
    }

    const fullName = getFirstAnswer(answers, ["Nom", "nom", "fullName", "name", "candidateName"]);
    const email = getFirstAnswer(answers, ["email", "candidateEmail"]);
    const templateNotificationOptIn = answers.notificationOptIn === true;
    const wantsNotifications = hasTemplateNotificationFields
      ? templateNotificationOptIn
      : emailNotificationsConsent;
    const privateNotificationEmail = (
      hasTemplateNotificationFields ? getStringFieldValue(answers.notificationEmail) : notificationEmail
    )
      .trim()
      .toLowerCase();
    const message = getFirstAnswer(answers, ["Message", "message", "content", "request", "description", "demande"]);
    const ruleValues = toRuleValues(answers);
    const submissionAnswers = fields.reduce<Record<string, DynamicFieldValue>>((result, field) => {
      if (!supportedFieldTypes.has(field.type)) return result;
      if (!shouldDisplayField(field, ruleValues)) return result;
      if (privateFieldKeys.has(field.key)) return result;

      result[field.key] = field.type === "FILE" ? files[field.key]?.name ?? "" : answers[field.key] ?? "";
      return result;
    }, {});
    const derivedSubmission = deriveCandidateSubmissionFields(submissionAnswers);
    const candidateEmail =
      derivedSubmission.candidateEmail || email || `private-${crypto.randomUUID()}@goodissima.local`;
    const candidateName =
      derivedSubmission.candidateName || fullName || candidateEmail || privateNotificationEmail || "Candidat";

    const indicativeSignals = ruleIssues
      .filter((issue) => issue.rule.mode === "INDICATIVE")
      .map((issue) => `Écart à examiner — ${issue.message}`);
    const payload = {
      gLinkId,
      candidateName,
      candidateEmail,
      candidateNotificationEmail: wantsNotifications ? privateNotificationEmail : "",
      message: derivedSubmission.message || message,
      documentName: documentFields.documentName,
      documentUrl: documentFields.documentUrl,
      formTemplateId,
      templateVersionId,
      answers: indicativeSignals.length
        ? { ...submissionAnswers, simpleRuleSignals: indicativeSignals }
        : submissionAnswers,
      emailNotificationsConsent: wantsNotifications,
      ...(trustAdmissionToken ? { trustAdmissionToken } : {}),
    };

    setLoading(true);
    setAdmissionErrorMessage("");
    setIsAdmissionBlocked(false);

    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const submissionError = await getCaseSubmissionError(res);

        if (submissionError.code === trustAdmissionBlockedCode) {
          setIsAdmissionBlocked(true);
          toast.error(submissionError.message);
          return;
        }

        setAdmissionErrorMessage(submissionError.message);
        toast.error(submissionError.message);
        return;
      }

      const relationCase = await res.json();
      const candidateAccessToken =
        relationCase && typeof relationCase.candidateAccessToken === "string"
          ? relationCase.candidateAccessToken.trim()
          : "";
      if (!candidateAccessToken) {
        throw new Error("Le dossier a ete cree, mais son acces securise est indisponible.");
      }
      await uploadFormFiles(candidateAccessToken);

      toast.success(copy.messageSentToast);
      router.push(`/secure/${encodeURIComponent(candidateAccessToken)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de l'action");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <div className={`rounded-2xl border p-4 text-sm ${admissionMode === "VERIFIED_ONLY" ? "border-amber-200 bg-amber-50 text-amber-950" : "border-emerald-200 bg-emerald-50 text-emerald-950"}`}>
        <p className="font-semibold">Admission · {SECURE_LINK_ADMISSION_LABELS[admissionMode]}</p>
        <p className="mt-1">
          {admissionMode === "VERIFIED_ONLY"
            ? "Une identité Goodissima vérifiée sera demandée avant la création du dossier."
            : "Vous pouvez répondre sans fournir votre identité, sauf si le parcours la demande explicitement."}
        </p>
      </div>
      <DynamicFormRenderer
        fields={currentFields}
        values={answers}
        files={files}
        loading={loading}
        onChange={(key, value) => setAnswers({ ...answers, [key]: value })}
        onFileChange={(key, file) => setFiles({ ...files, [key]: file })}
      />
      {(!isMultiStep || currentStep === stepCount) && !hasTemplateNotificationFields && (
        <>
          <label className="flex gap-3 rounded-2xl border bg-white p-4 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={emailNotificationsConsent}
              onChange={(event) => setEmailNotificationsConsent(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300"
            />
            <span>
              {copy.notificationConsentTitle}
              <span className="mt-1 block text-xs text-slate-500">
                {copy.notificationConsentHelp}
              </span>
            </span>
          </label>
          {emailNotificationsConsent ? (
            <label className="block rounded-2xl border bg-white p-4">
              <span className="text-sm font-medium text-slate-700">{copy.notificationEmailLabel}</span>
              <input
                type="email"
                value={notificationEmail}
                onChange={(event) => setNotificationEmail(event.target.value)}
                placeholder={copy.notificationEmailPlaceholder}
                className="mt-2 w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              />
              <span className="mt-2 block text-xs text-slate-500">{copy.notificationEmailHelp}</span>
            </label>
          ) : null}
          <div className="rounded-2xl border p-4">
            <p className="mb-2 text-sm font-medium">{copy.documentOptionalTitle}</p>
            <p className="mb-3 text-sm text-slate-500">
              {copy.documentOptionalHelp}
            </p>
            <input
              className="mb-2 w-full rounded-xl border px-4 py-3"
              placeholder={copy.documentNamePlaceholder}
              value={documentFields.documentName}
              onChange={(e) => setDocumentFields({ ...documentFields, documentName: e.target.value })}
            />
            <input
              className="w-full rounded-xl border px-4 py-3"
              placeholder={copy.documentUrlPlaceholder}
              value={documentFields.documentUrl}
              onChange={(e) => setDocumentFields({ ...documentFields, documentUrl: e.target.value })}
            />
          </div>
        </>
      )}
      {isMultiStep && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>
              {copy.stepProgress.replace("{current}", String(currentStep)).replace("{total}", String(stepCount))}
            </span>
            <span>{Math.round((currentStep / stepCount) * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-slate-900"
              style={{ width: `${Math.round((currentStep / stepCount) * 100)}%` }}
            />
          </div>
        </div>
      )}
      <div className={isMultiStep ? "flex gap-3" : ""}>
        {isMultiStep && currentStep > 1 && (
          <button
            type="button"
            onClick={() => setCurrentStep(Math.max(currentStep - 1, 1))}
            disabled={loading}
            className="w-full rounded-2xl border px-5 py-3 text-slate-800 disabled:opacity-60"
          >
            {copy.back}
          </button>
        )}
        {isMultiStep && currentStep < stepCount ? (
          <button
            type="button"
            onClick={goToNextStep}
            disabled={loading}
            className="w-full rounded-2xl bg-slate-900 px-5 py-3 text-white disabled:opacity-60"
          >
            {copy.next}
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={loading}
            className="w-full rounded-2xl bg-slate-900 px-5 py-3 text-white disabled:opacity-60"
          >
            {loading ? copy.submitting : copy.submit}
          </button>
        )}
      </div>
      {isAdmissionBlocked ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <h3 className="font-semibold text-amber-950">{trustAdmissionBlockedMessage}</h3>
          <p className="mt-2 leading-6">
            Pour envoyer votre demande, vous devez disposer d'une identité Goodissima et obtenir
            l'attestation demandée.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Link
              className="rounded-xl bg-slate-900 px-4 py-3 text-center font-medium text-white"
              href={`/identity?next=${authNext}`}
            >
              Vérifier mon identité
            </Link>
            <Link
              className="rounded-xl border border-amber-300 bg-white px-4 py-3 text-center font-medium text-slate-900"
              href={`/signup?next=${authNext}`}
            >
              Créer mon identité Goodissima
            </Link>
            <Link
              className="rounded-xl border border-amber-300 bg-white px-4 py-3 text-center font-medium text-slate-900"
              href={`/login?next=${authNext}`}
            >
              J'ai déjà un compte
            </Link>
          </div>
        </div>
      ) : admissionErrorMessage ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {admissionErrorMessage}
        </p>
      ) : null}
    </div>
  );
}
