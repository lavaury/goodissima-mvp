"use client";

import Link from "next/link";
import { useState } from "react";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { QRCodeBox } from "@/components/QRCodeBox";
import { useToast } from "@/components/ToastProvider";

export function LinkCard({
  item,
}: {
  item: {
    id: string;
    slug: string;
    title: string;
    city?: string | null;
    cases?: Array<{ id: string }>;
  };
}) {
  const publicPath = `/l/${item.slug}`;
  const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}${publicPath}`;
  const latestCase = item.cases?.[0];
  const latestCasePath = latestCase ? `/cases/${latestCase.id}?refresh=1` : null;
  const [shared, setShared] = useState(false);
  const toast = useToast();

  async function shareLink() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Lien securise Goodissima",
          text: "Accedez a votre espace securise Goodissima.",
          url: publicUrl,
        });
        toast.success("Lien partage");
        return;
      }

      await navigator.clipboard.writeText(publicUrl);
      setShared(true);
      toast.success("Lien partage");
      setTimeout(() => setShared(false), 2000);
    } catch {
      toast.error("Erreur lors de l'action");
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold">{item.title}</h3>
      {item.city && <p className="text-sm text-slate-500">{item.city}</p>}

      <div className="mt-4 rounded-xl bg-slate-50 p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Lien a partager
        </p>
        <input value={publicUrl} readOnly className="w-full rounded-lg border bg-white px-3 py-2 text-sm" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <CopyLinkButton value={publicUrl} />
        <button type="button" onClick={shareLink} className="rounded-xl border px-4 py-2 text-sm">
          {shared ? "Lien copie" : "Partager"}
        </button>
        <Link className="rounded-xl border px-4 py-2 text-sm" href={publicPath}>
          Voir le lien
        </Link>
        {latestCase ? (
          <Link
            className="rounded-xl border px-4 py-2 text-sm"
            href={latestCasePath!}
            prefetch={false}
          >
            Voir le dossier
          </Link>
        ) : (
          <span className="px-4 py-2 text-sm text-slate-500">En attente de contact</span>
        )}
      </div>

      <div className="mt-5">
        <QRCodeBox value={publicUrl} fileName={`goodissima-${item.slug}.png`} />
      </div>
    </div>
  );
}
