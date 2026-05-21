"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import type { ConditionalRule, FormValues } from "@/lib/form-rules";
import { isFieldDisabled, isFieldRequired, shouldDisplayField } from "@/lib/form-rules";

type FieldValue = string | boolean;

type CandidateFormFieldOption = {
  label: string;
  value: string;
};

type CandidateFormField = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  placeholder: string | null;
  defaultValue: string | null;
  options: CandidateFormFieldOption[];
  conditionalRules: ConditionalRule[];
};

const supportedFieldTypes = new Set([
  "TEXT",
  "EMAIL",
  "TEXTAREA",
  "PHONE",
  "NUMBER",
  "DATE",
  "SELECT",
  "CHECKBOX",
  "FILE",
]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function createInitialAnswers(fields: CandidateFormField[]) {
  return fields.reduce<Record<string, FieldValue>>((answers, field) => {
    answers[field.key] =
      field.type === "CHECKBOX" ? field.defaultValue === "true" : field.defaultValue ?? "";
    return answers;
  }, {});
}

function getStringValue(value: FieldValue | undefined) {
  return typeof value === "string" ? value : "";
}

function toRuleValues(values: Record<string, FieldValue>): FormValues {
  return values;
}

export default function CandidateForm({
  gLinkId,
  formTemplateId,
  fields,
}: {
  gLinkId: string;
  formTemplateId: string | null;
  fields: CandidateFormField[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState<Record<string, FieldValue>>(() => createInitialAnswers(fields));
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [documentFields, setDocumentFields] = useState({
    documentName: "",
    documentUrl: "",
  });

  function validateForm() {
    const ruleValues = toRuleValues(answers);

    for (const field of fields.filter(
      (item) =>
        supportedFieldTypes.has(item.type) &&
        shouldDisplayField(item, ruleValues) &&
        !isFieldDisabled(item, ruleValues),
    )) {
      const value = answers[field.key];
      const stringValue = getStringValue(value).trim();

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

  async function uploadFormFiles(candidateAccessToken: string, uploadedByEmail: string) {
    const fileEntries = Object.entries(files).filter((entry): entry is [string, File] =>
      Boolean(entry[1]),
    );

    for (const [, file] of fileEntries) {
      const formData = new FormData();
      formData.append("candidateAccessToken", candidateAccessToken);
      formData.append("uploadedByEmail", uploadedByEmail);
      formData.append("file", file);

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Unable to upload file");
      }
    }
  }

  async function submit() {
    if (!validateForm()) {
      toast.error("Erreur lors de l'action");
      return;
    }

    const fullName = getStringValue(answers.fullName).trim();
    const email = getStringValue(answers.email).trim();
    const message = getStringValue(answers.message).trim();
    const ruleValues = toRuleValues(answers);
    const submissionAnswers = fields.reduce<Record<string, FieldValue>>((result, field) => {
      if (!supportedFieldTypes.has(field.type)) return result;
      if (!shouldDisplayField(field, ruleValues)) return result;

      result[field.key] = field.type === "FILE" ? files[field.key]?.name ?? "" : answers[field.key] ?? "";
      return result;
    }, {});

    const payload = {
      gLinkId,
      candidateName: fullName,
      candidateEmail: email,
      message,
      documentName: documentFields.documentName,
      documentUrl: documentFields.documentUrl,
      formTemplateId,
      answers: submissionAnswers,
    };

    setLoading(true);

    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        toast.error("Erreur lors de l'action");
        return;
      }

      const relationCase = await res.json();
      await uploadFormFiles(relationCase.candidateAccessToken, email);

      toast.success("Message envoye");
      router.push(`/secure/${encodeURIComponent(relationCase.candidateAccessToken)}`);
    } catch {
      toast.error("Erreur lors de l'action");
    } finally {
      setLoading(false);
    }
  }

  function renderField(field: CandidateFormField) {
    const ruleValues = toRuleValues(answers);
    if (!shouldDisplayField(field, ruleValues)) return null;

    const disabled = loading || isFieldDisabled(field, ruleValues);
    const required = isFieldRequired(field, ruleValues);

    switch (field.type) {
      case "TEXTAREA":
        return (
          <textarea
            key={field.key}
            className="min-h-32 w-full rounded-xl border px-4 py-3"
            placeholder={field.placeholder ?? undefined}
            value={getStringValue(answers[field.key])}
            required={required}
            disabled={disabled}
            onChange={(e) => setAnswers({ ...answers, [field.key]: e.target.value })}
          />
        );
      case "SELECT":
        return (
          <select
            key={field.key}
            className="w-full rounded-xl border px-4 py-3"
            value={getStringValue(answers[field.key])}
            required={required}
            disabled={disabled}
            onChange={(e) => setAnswers({ ...answers, [field.key]: e.target.value })}
          >
            <option value="">{field.placeholder ?? field.label}</option>
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      case "CHECKBOX":
        return (
          <label key={field.key} className="flex items-start gap-3 rounded-xl border px-4 py-3">
            <input
              className="mt-1"
              type="checkbox"
              checked={answers[field.key] === true}
              required={required}
              disabled={disabled}
              onChange={(e) => setAnswers({ ...answers, [field.key]: e.target.checked })}
            />
            <span className="text-sm text-slate-700">{field.label}</span>
          </label>
        );
      case "FILE":
        return (
          <div key={field.key} className="rounded-xl border px-4 py-3">
            <p className="mb-2 text-sm font-medium">{field.label}</p>
            <input
              className="w-full text-sm"
              type="file"
              required={required}
              disabled={disabled}
              onChange={(e) => setFiles({ ...files, [field.key]: e.target.files?.[0] ?? null })}
            />
          </div>
        );
      default:
        return (
          <input
            key={field.key}
            className="w-full rounded-xl border px-4 py-3"
            type={
              field.type === "EMAIL"
                ? "email"
                : field.type === "PHONE"
                  ? "tel"
                  : field.type === "NUMBER"
                    ? "number"
                    : field.type === "DATE"
                      ? "date"
                      : "text"
            }
            placeholder={field.placeholder ?? undefined}
            value={getStringValue(answers[field.key])}
            required={required}
            disabled={disabled}
            onChange={(e) => setAnswers({ ...answers, [field.key]: e.target.value })}
          />
        );
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {fields.filter((field) => supportedFieldTypes.has(field.type)).map(renderField)}
      <div className="rounded-2xl border p-4">
        <p className="mb-2 text-sm font-medium">Document optionnel</p>
        <p className="mb-3 text-sm text-slate-500">
          Vous pouvez ajouter un lien vers un document si le proprietaire l'a demande.
        </p>
        <input
          className="mb-2 w-full rounded-xl border px-4 py-3"
          placeholder="Nom du document"
          value={documentFields.documentName}
          onChange={(e) => setDocumentFields({ ...documentFields, documentName: e.target.value })}
        />
        <input
          className="w-full rounded-xl border px-4 py-3"
          placeholder="URL du document"
          value={documentFields.documentUrl}
          onChange={(e) => setDocumentFields({ ...documentFields, documentUrl: e.target.value })}
        />
      </div>
      <button
        onClick={submit}
        disabled={loading}
        className="w-full rounded-2xl bg-slate-900 px-5 py-3 text-white disabled:opacity-60"
      >
        {loading ? "Envoi en cours..." : "Envoyer ma demande"}
      </button>
    </div>
  );
}
