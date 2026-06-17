"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PublishTemplateButton } from "@/components/PublishTemplateButton";
import { OPPORTUNITY_BUSINESS_WORDING, opportunityEditHref } from "@/lib/opportunity-preview";
import type { AnnouncementPublicationResult } from "@/lib/announcement-publication";

export function OpportunityPreviewActions({ templateId, relationTemplateId, returnHref, isPublished, onPublished }: { templateId: string; relationTemplateId: string; returnHref: string; isPublished: boolean; onPublished: (result: AnnouncementPublicationResult) => void }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!confirmDelete) return setConfirmDelete(true);
    setDeleting(true); setError(null);
    const response = await fetch(`/api/templates/${templateId}`, { method: "DELETE" });
    setDeleting(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(typeof body.error === "string" ? body.error : "Suppression impossible.");
      return;
    }
    router.push(returnHref);
    router.refresh();
  }

  return <div><div className="flex flex-wrap gap-2"><Link href={opportunityEditHref(templateId)} className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700">Modifier l'annonce</Link><PublishTemplateButton templateId={templateId} label={OPPORTUNITY_BUSINESS_WORDING.publish} isPublished={isPublished} onPublished={onPublished} />{isPublished ? <Link href={`/links/new?templateId=${encodeURIComponent(relationTemplateId)}`} className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-900">Créer un lien sécurisé</Link> : null}<button type="button" onClick={() => void remove()} disabled={deleting} className="rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">{deleting ? "Suppression..." : confirmDelete ? "Confirmer la suppression" : "Supprimer"}</button><Link href={returnHref} className="rounded-xl border px-4 py-2 text-sm font-semibold text-violet-700">Retour à l'assistant</Link></div>{!isPublished ? <p className="mt-2 text-xs text-slate-500">Publiez l'annonce pour créer ensuite son lien sécurisé.</p> : null}{error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}</div>;
}
