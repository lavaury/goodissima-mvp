"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { DebugCreateTestCaseButton } from "@/components/DebugCreateTestCaseButton";
import { DebugDeleteCaseButton } from "@/components/DebugDeleteCaseButton";
import { DebugDeleteLinkButton } from "@/components/DebugDeleteLinkButton";
import { LinkAdmissionPanel, type LinkAdmissionMode } from "@/components/LinkAdmissionPanel";
import { QRCodeBox } from "@/components/QRCodeBox";
import { useToast } from "@/components/ToastProvider";
import { announcementStatusLabel, type AnnouncementStatus } from "@/lib/announcement-archive";

export function LinkCard({
  item,
  publicAppUrl,
  debugMode = false,
  boussoleOpportunityExample = false,
}: {
  item: {
    id: string;
    slug: string;
    title: string;
    city?: string | null;
    status?: AnnouncementStatus;
    templateName?: string | null;
    templateStatus?: string | null;
    templateVersion?: number | null;
    admissionMode?: LinkAdmissionMode;
    openActionCount?: number;
    matchingStatus?: "DISABLED" | "TO_ANALYZE" | "MATCHES_TO_REVIEW" | "FOLLOW_UP_TO_DECIDE" | "NO_RESULTS";
    matchingCount?: number;
    sourceJourneyHref?: string;
    cases?: Array<{ id: string; candidateEmail?: string; lastActivityAt?: number }>;
  };
  debugMode?: boolean;
  boussoleOpportunityExample?: boolean;
  publicAppUrl: string;
}) {
  const publicPath = `/l/${item.slug}`;
  const publicUrl = `${publicAppUrl}${publicPath}`;
  const latestCase = item.cases?.[0];
  const latestCasePath = latestCase ? `/cases/${latestCase.id}?refresh=1` : null;
  const linkCasesPath = `/links/${item.id}`;
  const caseCount = item.cases?.length ?? 0;
  const [shared, setShared] = useState(false);
  const [status, setStatus] = useState<AnnouncementStatus>(item.status ?? "ACTIVE");
  const [archiving, setArchiving] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function archiveAnnouncement() {
    setArchiving(true);
    try {
      const response = await fetch(`/api/links/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(typeof result.error === "string" ? result.error : "Archivage impossible");
        return;
      }
      setStatus("ARCHIVED");
      toast.success("Annonce archivée.");
      router.push("/opportunities?view=archived");
      router.refresh();
    } finally {
      setArchiving(false);
    }
  }

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
    <div data-boussole-id={boussoleOpportunityExample ? "opportunity-card" : "dashboard-link-card"} className="rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div data-boussole-id={boussoleOpportunityExample ? "opportunity-card-title" : "dashboard-link-identification"}>
          <h3 className="text-lg font-semibold">{item.title}</h3>
          {item.city && <p className="text-sm text-slate-500">{item.city}</p>}
        </div>
        {item.openActionCount ? (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
            {item.openActionCount} demande{item.openActionCount > 1 ? "s" : ""}
          </span>
        ) : null}
        {item.status ? (
          <span data-boussole-id={boussoleOpportunityExample ? "opportunity-card-status" : "dashboard-link-status"} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
            {announcementStatusLabel(status)}
          </span>
        ) : null}
      </div>
      {debugMode && item.templateName ? (
        <p className="mt-1 text-xs text-slate-500">
          {item.templateName} {item.templateVersion ? `- v${item.templateVersion}` : "- version courante"}{" "}
          {item.templateStatus ? `(${item.templateStatus})` : ""}
        </p>
      ) : null}
      {!debugMode && item.templateName ? <p className="mt-2 text-xs text-slate-500">Parcours source : <strong>{item.templateName}</strong>{item.sourceJourneyHref ? <> · <Link href={item.sourceJourneyHref} className="font-semibold text-[#247f88] underline">Voir le parcours</Link></> : null}</p> : null}
      <p data-boussole-id={boussoleOpportunityExample ? "opportunity-card-case-count" : "dashboard-link-case-count"} className="mt-1 text-xs text-slate-500">{caseCount === 0 ? "Aucun dossier" : `${caseCount} dossier${caseCount > 1 ? "s" : ""}`}</p>

      <div data-boussole-id={boussoleOpportunityExample ? "opportunity-card-public-link" : "dashboard-link-public-url"} className="mt-4 rounded-xl bg-slate-50 p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Lien sécurisé vers l'annonce
        </p>
        <input value={publicUrl} readOnly className="w-full rounded-lg border bg-white px-3 py-2 text-sm" />
      </div>

      {item.matchingStatus && item.matchingStatus !== "DISABLED" ? (
        <div data-boussole-id={boussoleOpportunityExample ? "opportunity-matching-status" : "dashboard-link-matching-status"} data-boussole-state={item.matchingStatus} className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 p-3"><span data-boussole-id="dashboard-link-matching-indicator" className="sr-only">État du matching</span>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-cyan-900">Matching relationnel</p>
            <MatchingBadge status={item.matchingStatus} count={item.matchingCount ?? 0} />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-cyan-800">
            {item.matchingStatus === "TO_ANALYZE"
              ? "Le matching est activé pour ce lien."
              : item.matchingStatus === "MATCHES_TO_REVIEW"
                ? "Des correspondances potentielles attendent un examen humain."
                : item.matchingStatus === "FOLLOW_UP_TO_DECIDE"
                  ? "Une correspondance intéressante attend une décision humaine."
                  : "L’analyse est terminée sans correspondance exploitable."}
          </p>
          {item.matchingStatus !== "NO_RESULTS" ? (
            <Link data-boussole-id={boussoleOpportunityExample ? "open-opportunity-matching" : "dashboard-link-open-matching"} href={`/links/${item.id}#matching`} className="mt-3 inline-block rounded-lg bg-cyan-900 px-3 py-2 text-xs font-bold text-white">
              {item.matchingStatus === "TO_ANALYZE" ? "Ouvrir le matching" : item.matchingStatus === "MATCHES_TO_REVIEW" ? "Examiner" : "Décider de la suite"}
            </Link>
          ) : null}
        </div>
      ) : <div data-boussole-id={boussoleOpportunityExample ? "opportunity-matching-status" : "dashboard-link-matching-status"} data-boussole-state="DISABLED" className="mt-4 rounded-xl border bg-slate-50 p-3 text-xs text-slate-600"><strong>Matching relationnel :</strong> désactivé pour ce lien.</div>}

      <div data-boussole-id="dashboard-link-actions" className="mt-4 flex flex-wrap gap-2">
        <span data-boussole-id={boussoleOpportunityExample ? "copy-opportunity-link" : "dashboard-link-copy"}><CopyLinkButton value={publicUrl} /></span>
        <button data-boussole-id={boussoleOpportunityExample ? "share-opportunity" : "dashboard-link-share"} type="button" onClick={shareLink} className="rounded-xl border px-4 py-2 text-sm">
          {shared ? "Lien copie" : "Partager"}
        </button>
        <Link data-boussole-id={boussoleOpportunityExample ? "view-public-opportunity" : "dashboard-link-public-view"} className="rounded-xl border px-4 py-2 text-sm" href={publicPath}>
          Voir l'annonce publique
        </Link>
        <Link data-boussole-id={boussoleOpportunityExample ? "manage-opportunity" : "dashboard-link-manage"} className="rounded-xl border px-4 py-2 text-sm font-semibold" href={linkCasesPath}>
          Gérer l'annonce
        </Link>
        {status === "ARCHIVED" ? (
          <span className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">
            Annonce archivée
          </span>
        ) : status === "ACTIVE" ? (
          <button
            type="button"
            data-boussole-id={boussoleOpportunityExample ? "archive-announcement" : "dashboard-link-archive"}
            onClick={() => void archiveAnnouncement()}
            disabled={archiving}
            className="rounded-xl border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-800 disabled:opacity-40"
          >
            {archiving ? "Archivage..." : "Archiver l'annonce"}
          </button>
        ) : null}
        {!debugMode && caseCount === 0 ? (
          <span className="px-4 py-2 text-sm text-slate-500">Aucun dossier</span>
        ) : null}
        {!debugMode && caseCount === 1 && latestCase ? (
          <Link
            data-boussole-id={boussoleOpportunityExample ? "open-opportunity-cases" : undefined}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white"
            href={latestCasePath!}
            prefetch={false}
          >
            Ouvrir le dossier
          </Link>
        ) : null}
        {!debugMode && caseCount > 1 ? (
          <Link
            data-boussole-id={boussoleOpportunityExample ? "open-opportunity-cases" : undefined}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white"
            href={linkCasesPath}
            prefetch={false}
          >
            Voir les {caseCount} dossiers
          </Link>
        ) : null}
      </div>

      <div data-boussole-id={boussoleOpportunityExample ? "opportunity-admission" : "dashboard-link-admission"}><LinkAdmissionPanel linkId={item.id} initialMode={item.admissionMode ?? "OPEN"} /></div>

      {debugMode ? (
        <div className="mt-5 space-y-4 rounded-xl bg-amber-50 p-3 text-sm ring-1 ring-amber-200">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold uppercase tracking-wide text-amber-800">Debug GLink</span>
            <span className="text-amber-950">{publicPath}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyLinkButton value={publicUrl} />
            <Link className="rounded-xl border bg-white px-4 py-2 text-sm" href={publicPath}>
              Voir l'annonce publique
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

      <div data-boussole-id="dashboard-link-qr" className="mt-5">
        <QRCodeBox value={publicUrl} fileName={`goodissima-${item.slug}.png`} />
      </div>
    </div>
  );
}

function MatchingBadge({
  status,
  count,
}: {
  status: "TO_ANALYZE" | "MATCHES_TO_REVIEW" | "FOLLOW_UP_TO_DECIDE" | "NO_RESULTS";
  count: number;
}) {
  const label =
    status === "TO_ANALYZE"
      ? "À analyser"
      : status === "MATCHES_TO_REVIEW"
        ? `${count || ""}${count ? " · " : ""}Correspondances à examiner`
        : status === "FOLLOW_UP_TO_DECIDE"
          ? "Suite à décider"
          : "Aucune correspondance exploitable";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${status === "NO_RESULTS" ? "bg-slate-100 text-slate-600" : status === "FOLLOW_UP_TO_DECIDE" ? "bg-amber-100 text-amber-800" : "bg-white text-cyan-900 ring-1 ring-cyan-200"}`}>{label}</span>;
}
