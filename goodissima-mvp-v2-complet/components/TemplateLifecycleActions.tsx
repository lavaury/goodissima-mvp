"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";

async function getApiErrorMessage(res: Response) {
  try {
    const body = await res.json();
    return {
      message: typeof body.error === "string" ? body.error : "Erreur lors de l'action",
      activeLinks: typeof body.activeLinks === "number" ? body.activeLinks : 0,
    };
  } catch {
    return { message: "Erreur lors de l'action", activeLinks: 0 };
  }
}

export function TemplateLifecycleActions({
  templateId,
  isArchived,
}: {
  templateId: string;
  isArchived: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState<"duplicate" | "archive" | null>(null);
  const [needsArchiveConfirm, setNeedsArchiveConfirm] = useState(false);

  async function duplicate() {
    setLoading("duplicate");

    const res = await fetch(`/api/templates/${templateId}/duplicate`, { method: "POST" });

    setLoading(null);

    if (!res.ok) {
      const error = await getApiErrorMessage(res);
      toast.error(error.message);
      return;
    }

    const template = await res.json();
    toast.success("Parcours dupliqué");
    router.push(`/templates/${template.id}`);
    router.refresh();
  }

  async function archive(confirm = false) {
    setLoading("archive");

    const res = await fetch(`/api/templates/${templateId}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm }),
    });

    setLoading(null);

    if (res.status === 409) {
      const error = await getApiErrorMessage(res);
      setNeedsArchiveConfirm(true);
      toast.error(error.message);
      return;
    }

    if (!res.ok) {
      const error = await getApiErrorMessage(res);
      toast.error(error.message);
      return;
    }

    setNeedsArchiveConfirm(false);
    toast.success("Parcours archivé");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => void duplicate()}
        disabled={Boolean(loading)}
        className="rounded-xl border px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
      >
        {loading === "duplicate" ? "Duplication..." : "Dupliquer"}
      </button>
      <button
        type="button"
        onClick={() => void archive(needsArchiveConfirm)}
        disabled={Boolean(loading) || isArchived}
        className="rounded-xl border border-amber-300 px-4 py-2 text-sm font-medium text-amber-800 disabled:opacity-60"
      >
        {needsArchiveConfirm ? "Confirmer l'archivage" : loading === "archive" ? "Archivage..." : "Archiver le parcours"}
      </button>
    </div>
  );
}
