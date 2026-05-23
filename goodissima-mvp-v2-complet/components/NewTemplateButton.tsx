"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/ToastProvider";

const journeyTypes = [
  { value: "RECRUITMENT", label: "Recrutement", description: "Identité, email, CV et consentement." },
  { value: "REAL_ESTATE", label: "Immobilier", description: "Identité, justificatifs et validation dossier." },
  { value: "SALES", label: "Vente", description: "Qualification, besoin et decision." },
  { value: "SUPPORT", label: "Support", description: "Demande, urgence et pièces jointes." },
  { value: "KYC", label: "KYC", description: "Identité, organisation et justificatif." },
  { value: "EMPTY", label: "Vide", description: "Départ sans champ préconfiguré." },
];

function keyFromName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60);
}

async function getApiErrorMessage(res: Response) {
  try {
    const body = await res.json();
    return typeof body.error === "string" ? body.error : "Erreur lors de l'action";
  } catch {
    return "Erreur lors de l'action";
  }
}

export function NewTemplateButton() {
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [keyEdited, setKeyEdited] = useState(false);
  const [form, setForm] = useState({ name: "", key: "", description: "", journeyType: "EMPTY" });
  const generatedKey = useMemo(() => keyFromName(form.name), [form.name]);
  const effectiveKey = keyEdited ? form.key : generatedKey;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, key: effectiveKey }),
    });

    setSaving(false);

    if (!res.ok) {
      toast.error(await getApiErrorMessage(res));
      return;
    }

    const template = await res.json();
    toast.success(t("studio.createdToast"));
    router.push(`/templates/${template.id}`);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
      >
        {t("studio.new")}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 rounded-2xl border bg-white p-5">
      <div className="mb-4">
        <h2 className="font-semibold">{t("studio.new")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("studio.businessBaseHelp")}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <input
          className="rounded-xl border px-4 py-3"
          placeholder={t("studio.namePlaceholder")}
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
        <input
          className="rounded-xl border px-4 py-3 font-mono text-sm"
          placeholder="KEY_TEMPLATE"
          value={effectiveKey}
          onChange={(event) => {
            setKeyEdited(true);
            setForm({ ...form, key: event.target.value });
          }}
        />
        <textarea
          className="min-h-24 rounded-xl border px-4 py-3 md:col-span-2"
          placeholder={t("studio.description")}
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
        />
        <div className="md:col-span-2">
          <p className="mb-2 text-sm font-medium text-slate-700">{t("studio.journeyType")}</p>
          <div className="grid gap-2 md:grid-cols-3">
            {journeyTypes.map((type) => {
              const selected = form.journeyType === type.value;

              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setForm({ ...form, journeyType: type.value })}
                  className={
                    selected
                      ? "rounded-xl border border-slate-900 bg-slate-900 p-3 text-left text-white"
                      : "rounded-xl border bg-white p-3 text-left text-slate-700 transition hover:bg-slate-50"
                  }
                >
                  <span className="block text-sm font-medium">{type.label}</span>
                  <span className={selected ? "mt-1 block text-xs text-slate-200" : "mt-1 block text-xs text-slate-500"}>
                    {type.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? t("studio.creation") : t("studio.createJourney")}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl border px-4 py-2 text-sm font-medium text-slate-700"
        >
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}
