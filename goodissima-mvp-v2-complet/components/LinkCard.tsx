"use client";

import Link from "next/link";
import { useState } from "react";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { DebugCreateTestCaseButton } from "@/components/DebugCreateTestCaseButton";
import { DebugDeleteCaseButton } from "@/components/DebugDeleteCaseButton";
import { DebugDeleteLinkButton } from "@/components/DebugDeleteLinkButton";
import { QRCodeBox } from "@/components/QRCodeBox";
import { useToast } from "@/components/ToastProvider";

export function LinkCard({
  item,
  debugMode = false,
}: {
  item: {
    id: string;
    slug: string;
    title: string;
    city?: string | null;
    templateName?: string | null;
    templateStatus?: string | null;
    templateVersion?: number | null;
    openActionCount?: number;
    cases?: Array<{ id: string; candidateEmail?: string; lastActivityAt?: number }>;
  };
  debugMode?: boolean;
}) {
  const publicPath = `/l/${item.slug}`;
  const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}${publicPath}`;
  const latestCase = item.cases?.[0];
  const latestCasePath = latestCase ? `/cases/${latestCase.id}?refresh=1` : null;
  const linkCasesPath = `/links/${item.id}`;
  const caseCount = item.cases?.length ?? 0;
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
    <div className="rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{item.title}</h3>
          {item.city && <p className="text-sm text-slate-500">{item.city}</p>}
        </div>
        {item.openActionCount ? (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
            {item.openActionCount} demande{item.openActionCount > 1 ? "s" : ""}
          </span>
        ) : null}
      </div>
      {item.templateName ? (
        <p className="mt-1 text-xs text-slate-500">
          {item.templateName} {item.templateVersion ? `- v${item.templateVersion}` : "- version courante"}{" "}
          {item.templateStatus ? `(${item.templateStatus})` : ""}
        </p>
      ) : null}
      {caseCount > 1 ? (
        <p className="mt-1 text-xs text-slate-500">{caseCount} dossiers</p>
      ) : null}

      <div className="mt-4 rounded-xl bg-slate-50 p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Lien public candidat
        </p>
        <input value={publicUrl} readOnly className="w-full rounded-lg border bg-white px-3 py-2 text-sm" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <CopyLinkButton value={publicUrl} />
        <button type="button" onClick={shareLink} className="rounded-xl border px-4 py-2 text-sm">
          {shared ? "Lien copie" : "Partager"}
        </button>
        <Link className="rounded-xl border px-4 py-2 text-sm" href={publicPath}>
          Tester parcours
        </Link>
        {!debugMode && caseCount === 0 ? (
          <span className="px-4 py-2 text-sm text-slate-500">Aucun dossier</span>
        ) : null}
        {!debugMode && caseCount === 1 && latestCase ? (
          <Link
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white"
            href={latestCasePath!}
            prefetch={false}
          >
            Ouvrir le dossier
          </Link>
        ) : null}
        {!debugMode && caseCount > 1 ? (
          <Link
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white"
            href={linkCasesPath}
            prefetch={false}
          >
            Voir les {caseCount} dossiers
          </Link>
        ) : null}
      </div>

      {debugMode ? (
        <div className="mt-5 space-y-4 rounded-xl bg-amber-50 p-3 text-sm ring-1 ring-amber-200">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold uppercase tracking-wide text-amber-800">Debug GLink</span>
            <span className="text-amber-950">{publicPath}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyLinkButton value={publicUrl} />
            <Link className="rounded-xl border bg-white px-4 py-2 text-sm" href={publicPath}>
              Tester parcours
            </Link>
            <DebugCreateTestCaseButton linkId={item.id} />
          </div>

          <div className="space-y-3">
            {caseCount === 0 ? (
              <p className="rounded-xl bg-white px-3 py-2 text-slate-600 ring-1 ring-amber-100">
                Aucune conversation active
              </p>
            ) : (
              item.cases?.map((relationCase, index) => (
                <div key={relationCase.id} className="space-y-3 rounded-xl bg-white p-3 ring-1 ring-amber-100">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">Conversation test {index + 1}</p>
                      {relationCase.candidateEmail ? (
                        <p className="text-xs text-slate-500">{relationCase.candidateEmail}</p>
                      ) : null}
                    </div>
                    <Link
                      className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white"
                      href={`/cases/${relationCase.id}?refresh=1`}
                      prefetch={false}
                    >
                      Ouvrir dossier
                    </Link>
                  </div>
                  <DebugDeleteCaseButton caseId={relationCase.id} />
                </div>
              ))
            )}
          </div>

          <DebugDeleteLinkButton linkId={item.id} />
        </div>
      ) : null}

      <div className="mt-5">
        <QRCodeBox value={publicUrl} fileName={`goodissima-${item.slug}.png`} />
      </div>
    </div>
  );
}
