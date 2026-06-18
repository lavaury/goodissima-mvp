"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { announcementStatusLabel, type AnnouncementStatus } from "@/lib/announcement-archive";

export function AnnouncementActions({
  linkId,
  publicUrl,
  initialTitle,
  initialCity,
  initialDescription,
  initialStatus,
}: {
  linkId: string;
  publicUrl: string;
  initialTitle: string;
  initialCity: string;
  initialDescription: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [city, setCity] = useState(initialCity);
  const [description, setDescription] = useState(initialDescription);
  const [status, setStatus] = useState<AnnouncementStatus>(initialStatus as AnnouncementStatus);
  const [loading, setLoading] = useState<string | null>(null);

  async function patch(action: "update" | "publish" | "archive") {
    setLoading(action);
    const response = await fetch(`/api/links/${linkId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action === "update" ? { action, title, city, description } : { action }),
    });
    setLoading(null);

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      toast.error(typeof body.error === "string" ? body.error : "Action impossible");
      return;
    }

    const result = await response.json();
    if (typeof result.status === "string") setStatus(result.status as AnnouncementStatus);
    setEditing(false);
    toast.success(
      action === "update"
        ? "Annonce modifiée."
        : action === "publish"
          ? "Annonce publiée."
          : "Annonce archivée.",
    );
    router.refresh();
  }

  async function copySecureLink() {
    await navigator.clipboard.writeText(publicUrl);
    toast.success("Lien sécurisé copié.");
  }

  return (
    <section className="mt-6 rounded-2xl border bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Actions de l'annonce</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {announcementStatusLabel(status)}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => setEditing((value) => !value)} className="rounded-xl border px-4 py-2 text-sm font-semibold">
          Modifier l'annonce
        </button>
        <button type="button" onClick={() => void patch("publish")} disabled={loading !== null || status === "ACTIVE"} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
          Publier l'annonce
        </button>
        <button type="button" onClick={() => void copySecureLink()} className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-900">
          Créer un lien sécurisé
        </button>
        <button type="button" onClick={() => void patch("archive")} disabled={loading !== null || status === "ARCHIVED"} className="rounded-xl border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-800 disabled:opacity-40">
          {loading === "archive" ? "Archivage..." : "Archiver l'annonce"}
        </button>
      </div>
      {editing ? (
        <div className="mt-4 grid gap-3">
          <label className="text-sm font-medium">
            Titre
            <input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal" />
          </label>
          <label className="text-sm font-medium">
            Localisation
            <input value={city} onChange={(event) => setCity(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal" />
          </label>
          <label className="text-sm font-medium">
            Description
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 min-h-24 w-full rounded-xl border px-3 py-2 font-normal" />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={() => void patch("update")} disabled={!title.trim() || loading !== null} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
              Enregistrer l'annonce
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-xl border px-4 py-2 text-sm font-semibold">
              Annuler
            </button>
          </div>
        </div>
      ) : null}
      <p className="mt-3 text-xs text-slate-500">
        Aucune suppression n'est effectuée. Les relations existantes restent inchangées.
      </p>
    </section>
  );
}
