"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/ToastProvider";

export function PublishTemplateButton({ templateId }: { templateId: string }) {
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);

  async function publish() {
    setLoading(true);

    const res = await fetch(`/api/templates/${templateId}/publish`, {
      method: "POST",
    });

    setLoading(false);

    if (!res.ok) {
      try {
        const body = await res.json();
        toast.error(typeof body.error === "string" ? body.error : "Erreur lors de l'action");
      } catch {
        toast.error("Erreur lors de l'action");
      }
      return;
    }

    toast.success(t("studio.publishedToast"));
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={publish}
      disabled={loading}
      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
    >
      {loading ? "Publication..." : t("studio.publish")}
    </button>
  );
}
