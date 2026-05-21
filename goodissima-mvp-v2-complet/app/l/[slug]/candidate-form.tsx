"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { getFieldsForStep, getStepCount } from "@/lib/form-steps";
import { isFieldDisabled, isFieldRequired, shouldDisplayField } from "@/lib/form-rules";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function CandidateForm({
  gLinkId,
  formTemplateId,
  fields,
}: {
  gLinkId: string;
  formTemplateId: string | null;
  fields: DynamicFormField[];
}) {
  const router = useRouter();
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
  const stepCount = getStepCount(fields);
  const isMultiStep = stepCount > 1;
  const currentFields = isMultiStep ? getFieldsForStep(fields, currentStep) : fields;

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
    return validateFields(fields);
  }

  function goToNextStep() {
    if (!validateFields(currentFields)) {
      toast.error("Erreur lors de l'action");
      return;
    }

    setCurrentStep(Math.min(currentStep + 1, stepCount));
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

    const fullName = getStringFieldValue(answers.fullName).trim();
    const email = getStringFieldValue(answers.email).trim();
    const message = getStringFieldValue(answers.message).trim();
    const ruleValues = toRuleValues(answers);
    const submissionAnswers = fields.reduce<Record<string, DynamicFieldValue>>((result, field) => {
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

  return (
    <div className="mt-6 space-y-4">
      <DynamicFormRenderer
        fields={currentFields}
        values={answers}
        files={files}
        loading={loading}
        onChange={(key, value) => setAnswers({ ...answers, [key]: value })}
        onFileChange={(key, file) => setFiles({ ...files, [key]: file })}
      />
      {(!isMultiStep || currentStep === stepCount) && (
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
      )}
      {isMultiStep && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>
              Etape {currentStep} sur {stepCount}
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
            Retour
          </button>
        )}
        {isMultiStep && currentStep < stepCount ? (
          <button
            type="button"
            onClick={goToNextStep}
            disabled={loading}
            className="w-full rounded-2xl bg-slate-900 px-5 py-3 text-white disabled:opacity-60"
          >
            Suivant
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={loading}
            className="w-full rounded-2xl bg-slate-900 px-5 py-3 text-white disabled:opacity-60"
          >
            {loading ? "Envoi en cours..." : "Envoyer ma demande"}
          </button>
        )}
      </div>
    </div>
  );
}
