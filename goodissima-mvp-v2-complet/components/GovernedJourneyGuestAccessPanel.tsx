"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Access = { id: string; displayName: string; role: string; status: string; expiresAt: string; relationCaseId: string | null };

export function GovernedJourneyGuestAccessPanel({ formTemplateId, participantName, participantRole, governedRole, preparedEmail, invitations, relationCases }: {
  formTemplateId: string; participantName: string; participantRole: string; governedRole: string;
  preparedEmail?: string | null; invitations: Access[]; relationCases: Array<{ id: string; label: string }>;
}) {
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const active = invitations.find((item) => item.status === "ACTIVE" && new Date(item.expiresAt) > new Date());

  async function createAccess(formData: FormData) {
    setLink(null); setError(null);
    const response = await fetch("/api/gouvernance/invitations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      formTemplateId, displayName: participantName, participantName, participantRole, preparedEmail,
      role: governedRole, expiresInDays: formData.get("expiresInDays"), relationCaseId: formData.get("relationCaseId"),
    }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error ?? "Création impossible."); return; }
    setLink(data.link); router.refresh();
  }

  async function revoke(id: string) {
    setError(null);
    const response = await fetch(`/api/gouvernance/invitations/${id}/revoke`, { method: "POST" });
    if (!response.ok) { setError("La révocation a échoué."); return; }
    setLink(null); router.refresh();
  }

  return <section className="mt-4 rounded-lg border-2 border-[#247f88]/30 bg-white p-4">
    <h3 className="font-bold text-slate-950">Accès invité gouverné</h3>
    <p className="mt-1 text-sm text-slate-600">Créez un accès sécurisé limité à ce parcours. Goodissima ne l’envoie pas automatiquement.</p>
    {preparedEmail ? <p className="mt-2 text-xs text-slate-500">Email de préparation : {preparedEmail} — information uniquement, aucun envoi automatique.</p> : null}
    {active ? <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
      <p className="font-semibold text-emerald-950">Accès actif pour {active.displayName}</p>
      <p className="mt-1 text-xs text-emerald-900">Rôle : {active.role} · Statut : {active.status} · Expiration : {new Date(active.expiresAt).toLocaleString("fr-FR")}</p>
      <p className="mt-2 text-xs text-emerald-800">{active.relationCaseId ? "Cet invité pourra rejoindre la salle sécurisée rattachée." : "Aucune salle sécurisée rattachée à cet accès pour le moment."}</p>
      <p className="mt-2 text-xs text-emerald-800">Le lien secret n’est plus affichable. Il n’était disponible qu’après sa création.</p>
      <button type="button" onClick={() => revoke(active.id)} className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-700">Révoquer l’accès</button>
    </div> : <form action={createAccess} className="mt-3 flex flex-wrap items-end gap-3">
      <label className="text-xs font-semibold text-slate-600">Dossier / salle sécurisée<select name="relationCaseId" className="mt-1 block max-w-xs rounded-lg border px-3 py-2 text-sm font-normal"><option value="">Aucune salle rattachée</option>{relationCases.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label className="text-xs font-semibold text-slate-600">Durée de validité (jours)<input name="expiresInDays" type="number" min="1" max="30" defaultValue="7" className="mt-1 block w-36 rounded-lg border px-3 py-2 text-sm font-normal" /></label>
      <button className="rounded-lg bg-[#247f88] px-4 py-2 text-sm font-bold text-white">Créer un accès invité gouverné</button>
    </form>}
    {link ? <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3">
      <p className="font-semibold text-emerald-950">Copiez ce lien et transmettez-le par le canal de votre choix.</p>
      <input readOnly value={link} className="mt-2 w-full rounded border bg-white px-2 py-2 text-sm" />
      <button type="button" onClick={() => navigator.clipboard.writeText(link)} className="mt-2 rounded bg-emerald-800 px-3 py-2 text-sm font-semibold text-white">Copier le lien</button>
      <p className="mt-2 text-xs text-emerald-800">Ce lien en clair n’est affiché que dans cette confirmation.</p>
    </div> : null}
    {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
  </section>;
}
