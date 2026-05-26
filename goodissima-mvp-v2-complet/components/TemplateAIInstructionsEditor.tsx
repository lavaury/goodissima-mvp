"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/ToastProvider";

const maxInstructionsLength = 4000;

export function TemplateAIInstructionsEditor({
  templateId,
  initialValue,
  disabled = false,
}: {
  templateId: string;
  initialValue: string;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const remaining = maxInstructionsLength - value.length;

  async function save() {
    setSaving(true);

    const res = await fetch(`/api/templates/${encodeURIComponent(templateId)}/ai-instructions`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aiInstructions: value }),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(typeof body?.error === "string" ? body.error : t("studio.aiInstructions.error"));
      return;
    }

    toast.success(t("studio.aiInstructions.saved"));
    router.refresh();
  }

  return (
    <section className="mt-8 rounded-2xl border bg-white p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="font-semibold">{t("studio.aiInstructions.title")}</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">{t("studio.aiInstructions.help")}</p>
          <p className="mt-1 max-w-2xl text-xs text-slate-500">{t("studio.aiInstructions.safety")}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
          {t("studio.aiInstructions.future")}
        </span>
      </div>

      <textarea
        value={value}
        disabled={disabled || saving}
        maxLength={maxInstructionsLength}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t("studio.aiInstructions.placeholder")}
        className="mt-5 min-h-44 w-full resize-y rounded-xl border px-4 py-3 text-sm leading-relaxed outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-50"
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <span>{t("studio.aiInstructions.counter", { count: remaining })}</span>
        <span>{t("studio.aiInstructions.emptyFallback")}</span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Example title={t("studio.aiInstructions.example.realEstate.title")}>
          {t("studio.aiInstructions.example.realEstate.body")}
        </Example>
        <Example title={t("studio.aiInstructions.example.recruitment.title")}>
          {t("studio.aiInstructions.example.recruitment.body")}
        </Example>
        <Example title={t("studio.aiInstructions.example.investors.title")}>
          {t("studio.aiInstructions.example.investors.body")}
        </Example>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={disabled || saving}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? t("studio.aiInstructions.saving") : t("studio.aiInstructions.save")}
        </button>
      </div>
    </section>
  );
}

function Example({ title, children }: { title: string; children: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4 text-sm">
      <p className="font-medium text-slate-800">{title}</p>
      <p className="mt-2 text-slate-600">{children}</p>
    </div>
  );
}
