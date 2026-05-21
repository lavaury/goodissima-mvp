"use client";

import { useState } from "react";
import {
  DynamicFormRenderer,
  createInitialDynamicValues,
  type DynamicFieldValue,
  type DynamicFormField,
} from "@/components/DynamicFormRenderer";
import { getFieldsForStep, getStepCount } from "@/lib/form-steps";

export function DynamicFormPreview({
  fields,
  stepNames = {},
}: {
  fields: DynamicFormField[];
  stepNames?: Record<number, string>;
}) {
  const [values, setValues] = useState<Record<string, DynamicFieldValue>>(() =>
    createInitialDynamicValues(fields),
  );
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [currentStep, setCurrentStep] = useState(1);
  const stepCount = getStepCount(fields);
  const isMultiStep = stepCount > 1;
  const currentFields = isMultiStep ? getFieldsForStep(fields, currentStep) : fields;

  return (
    <div className="space-y-4">
      {isMultiStep && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>
              {stepNames[currentStep] || `Etape ${currentStep}`} sur {stepCount}
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
      <DynamicFormRenderer
        fields={currentFields}
        values={values}
        files={files}
        onChange={(key, value) => setValues({ ...values, [key]: value })}
        onFileChange={(key, file) => setFiles({ ...files, [key]: file })}
      />
      {isMultiStep && (
        <div className="flex gap-3">
          {currentStep > 1 && (
            <button
              type="button"
              className="w-full rounded-2xl border px-5 py-3 text-slate-800"
              onClick={() => setCurrentStep(Math.max(currentStep - 1, 1))}
            >
              Retour
            </button>
          )}
          {currentStep < stepCount && (
            <button
              type="button"
              className="w-full rounded-2xl bg-slate-900 px-5 py-3 text-white"
              onClick={() => setCurrentStep(Math.min(currentStep + 1, stepCount))}
            >
              Suivant
            </button>
          )}
        </div>
      )}
      {(!isMultiStep || currentStep === stepCount) && (
        <button
          type="button"
          disabled
          className="w-full rounded-2xl bg-slate-900 px-5 py-3 text-white opacity-60"
        >
          Envoyer ma demande
        </button>
      )}
    </div>
  );
}
