"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/ToastProvider";
import {
  ANNOUNCEMENT_PUBLICATION_SUCCESS,
  type AnnouncementPublicationResult,
} from "@/lib/announcement-publication";

export function PublishTemplateButton({ templateId, label = "Publier l'annonce", isPublished = false, onPublished }: { templateId: string; label?: string; isPublished?: boolean; onPublished?: (result: AnnouncementPublicationResult) => void }) {
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [published, setPublished] = useState(isPublished);

  async function publish() {
    setLoading(true);

    let res: Response;
    try {
      res = await fetch(`/api/templates/${templateId}/publish`, { method: "POST" });
    } catch {
      setLoading(false);
      toast.error("Publication impossible. Vérifiez votre connexion.");
      return;
    }

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

    const result = await res.json() as AnnouncementPublicationResult;
    setPublished(true);
    onPublished?.(result);
    toast.success(ANNOUNCEMENT_PUBLICATION_SUCCESS);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={publish}
      disabled={loading || published}
      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
    >
      {loading ? "Publication..." : published ? "Annonce publiée" : label || t("studio.publish")}
    </button>
  );
}
