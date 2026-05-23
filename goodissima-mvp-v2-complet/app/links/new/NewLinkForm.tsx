"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/ToastProvider";

type RelationTemplateOption = {
  id: string;
  key: string;
  name: string;
  status: string;
  activeVersion: { version: number; createdAt: string } | null;
  steps: Array<{
    step: number;
    fields: Array<{ key: string; label: string; type: string; required: boolean }>;
  }>;
  rules: string[];
};

export function NewLinkForm({
  templates,
  defaultTemplateId,
}: {
  templates: RelationTemplateOption[];
  defaultTemplateId: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const [form, setForm] = useState({
    title: "",
    city: "",
    description: "",
    templateId: defaultTemplateId ?? "",
    requireEmail: true,
    requireMessage: true,
    allowDocument: true,
  });
  const selectedTemplate = templates.find((template) => template.id === form.templateId) ?? templates[0] ?? null;

  async function submit() {
    if (!form.title.trim()) {
      toast.error("Erreur lors de l'action");
      return;
    }

    const res = await fetch("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      toast.error("Erreur lors de l'action");
      return;
    }

    const link = await res.json();
    router.refresh();
    router.push(`/l/${link.slug}`);
  }

  return (
    <div className="mt-8 space-y-4 rounded-2xl border bg-white p-6">
      <input
        className="w-full rounded-xl border px-4 py-3"
        placeholder={t("links.new.titlePlaceholder")}
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
      />
      <input
        className="w-full rounded-xl border px-4 py-3"
        placeholder={t("links.new.cityPlaceholder")}
        value={form.city}
        onChange={(e) => setForm({ ...form, city: e.target.value })}
      />
      <textarea
        className="min-h-32 w-full rounded-xl border px-4 py-3"
        placeholder={t("links.new.descriptionPlaceholder")}
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      />
      <select
        className="w-full rounded-xl border px-4 py-3"
        value={form.templateId}
        onChange={(e) => setForm({ ...form, templateId: e.target.value })}
      >
        {templates.map((template) => (
          <option key={template.id} value={template.id}>
            {template.name} ({template.key}) - {template.status}
          </option>
        ))}
      </select>
      {selectedTemplate ? (
        <div className="rounded-2xl border bg-slate-50 p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">{t("links.new.candidatePreview")}</p>
              <p className="text-xs text-slate-500">
                {selectedTemplate.activeVersion
                  ? t("links.new.publishedVersion", { version: selectedTemplate.activeVersion.version })
                  : t("links.new.noPublishedVersion")}
              </p>
            </div>
            <span className="self-start rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
              {selectedTemplate.status}
            </span>
          </div>
          {selectedTemplate.steps.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">{t("links.new.noPublishedField")}</p>
          ) : (
            <div className="mt-4 space-y-3">
              {selectedTemplate.steps.map((step) => (
                <div key={step.step} className="rounded-xl bg-white p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {t("studio.step")} {step.step}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {step.fields.map((field) => (
                      <span key={field.key} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                        {field.label} ({field.type}){field.required ? " *" : ""}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {selectedTemplate.rules.length > 0 ? (
            <div className="mt-4 rounded-xl bg-white p-3 text-xs text-slate-600">
              <p className="mb-2 font-medium text-slate-700">{t("links.new.mainRules")}</p>
              <div className="space-y-1">
                {selectedTemplate.rules.slice(0, 5).map((rule, index) => (
                  <p key={index}>{rule}</p>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      <label className="flex gap-2">
        <input
          type="checkbox"
          checked={form.requireEmail}
          onChange={(e) => setForm({ ...form, requireEmail: e.target.checked })}
        />
        {t("links.new.requireEmail")}
      </label>
      <label className="flex gap-2">
        <input
          type="checkbox"
          checked={form.requireMessage}
          onChange={(e) => setForm({ ...form, requireMessage: e.target.checked })}
        />
        {t("links.new.requireMessage")}
      </label>
      <label className="flex gap-2">
        <input
          type="checkbox"
          checked={form.allowDocument}
          onChange={(e) => setForm({ ...form, allowDocument: e.target.checked })}
        />
        {t("links.new.allowDocument")}
      </label>
      <button onClick={submit} className="w-full rounded-2xl bg-slate-900 px-5 py-3 text-white">
        {t("links.new.generate")}
      </button>
    </div>
  );
}
