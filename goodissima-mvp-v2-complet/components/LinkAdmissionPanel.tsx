"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import {
  SECURE_LINK_ADMISSION_LABELS,
  type SecureLinkAdmissionMode,
} from "@/lib/secure-link-admission";

export type LinkAdmissionMode = SecureLinkAdmissionMode;

const admissionOptions: Array<{ mode: LinkAdmissionMode; label: string }> = [
  { mode: "OPEN", label: SECURE_LINK_ADMISSION_LABELS.OPEN },
  { mode: "VERIFIED_ONLY", label: SECURE_LINK_ADMISSION_LABELS.VERIFIED_ONLY },
];

export function LinkAdmissionPanel({
  linkId,
  initialMode,
}: {
  linkId: string;
  initialMode: LinkAdmissionMode;
}) {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<LinkAdmissionMode>(initialMode);
  const [savingMode, setSavingMode] = useState<LinkAdmissionMode | null>(null);

  async function updateAdmissionMode(nextMode: LinkAdmissionMode) {
    if (nextMode === mode || savingMode) return;

    const previousMode = mode;
    setMode(nextMode);
    setSavingMode(nextMode);

    try {
      const response = await fetch(`/api/links/${encodeURIComponent(linkId)}/admission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: nextMode }),
      });

      if (!response.ok) {
        setMode(previousMode);
        toast.error("Paramètre d'admission non enregistré");
        return;
      }

      toast.success("Paramètre d'admission enregistré");
      router.refresh();
    } catch {
      setMode(previousMode);
      toast.error("Erreur lors de l'action");
    } finally {
      setSavingMode(null);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Admission</p>
        <h2 className="text-xl font-semibold text-slate-950">Admission</h2>
        <p className="max-w-2xl text-sm leading-6 text-slate-500">
          Choisissez qui peut créer un dossier à partir de ce lien.
        </p>
      </div>

      <fieldset className="mt-4 space-y-3" disabled={savingMode !== null}>
        <legend className="sr-only">Mode d'admission</legend>
        {admissionOptions.map((option) => (
          <label
            key={option.mode}
            className={[
              "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition",
              mode === option.mode
                ? "border-slate-900 bg-slate-50 text-slate-950"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              savingMode ? "cursor-wait opacity-75" : "",
            ].join(" ")}
          >
            <input
              type="radio"
              name="admissionMode"
              value={option.mode}
              checked={mode === option.mode}
              onChange={() => updateAdmissionMode(option.mode)}
              className="h-4 w-4 accent-slate-900"
            />
            <span className="font-medium">{option.label}</span>
          </label>
        ))}
      </fieldset>

      <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
        En mode ouvert, une réponse anonyme reste possible. En mode vérifié, une identité Goodissima
        vérifiée est nécessaire avant de pouvoir créer un dossier.
      </p>
    </section>
  );
}
