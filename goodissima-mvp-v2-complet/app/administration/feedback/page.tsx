export const dynamic = "force-dynamic";

import Link from "next/link";
import { unstable_noStore as noStore, revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { DashboardBackLink } from "@/components/DashboardBackLink";
import { PlatformNavigation } from "@/components/PlatformNavigation";
import { getCurrentPrismaUser } from "@/lib/auth";
import {
  buildFeedbackStatusUpdate,
  buildFeedbackWhere,
  canAccessFeedbackAdmin,
  cleanFeedbackString,
  normalizeFeedbackStatus,
  productFeedbackStatuses,
  productFeedbackTypes,
} from "@/lib/product-feedback";
import { prisma } from "@/lib/prisma";

const statusLabels: Record<string, string> = {
  NEW: "Nouveau",
  IN_PROGRESS: "En cours",
  RESOLVED: "Résolu",
  IGNORED: "Ignoré",
};

function queryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: Date | null) {
  if (!value) return "Non renseigné";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function displayBrowserInfo(value: unknown) {
  if (!value || typeof value !== "object") return [];
  const info = value as {
    userAgent?: unknown;
    language?: unknown;
    viewport?: { width?: unknown; height?: unknown } | null;
    clientTimestamp?: unknown;
  };
  const rows: Array<[string, string]> = [];
  if (typeof info.language === "string") rows.push(["Langue", info.language]);
  if (typeof info.userAgent === "string") rows.push(["User agent", info.userAgent]);
  if (info.viewport && typeof info.viewport.width === "number" && typeof info.viewport.height === "number") {
    rows.push(["Viewport", `${info.viewport.width} x ${info.viewport.height}`]);
  }
  if (typeof info.clientTimestamp === "string") rows.push(["Horodatage client", info.clientTimestamp]);
  return rows;
}

async function updateFeedbackAction(formData: FormData) {
  "use server";

  const owner = await getCurrentPrismaUser();
  if (!canAccessFeedbackAdmin(owner.role)) notFound();

  const feedbackId = cleanFeedbackString(formData.get("feedbackId"), 120);
  if (!feedbackId) return;

  const status = normalizeFeedbackStatus(formData.get("status"));
  const adminNotes = cleanFeedbackString(formData.get("adminNotes"), 2000);

  await prisma.productFeedback.update({
    where: { id: feedbackId },
    data: buildFeedbackStatusUpdate(status, adminNotes),
  });

  revalidatePath("/administration/feedback");
}

export default async function FeedbackAdministrationPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  noStore();
  const owner = await getCurrentPrismaUser();
  if (!canAccessFeedbackAdmin(owner.role)) notFound();

  const organizationName = owner.name && owner.name !== owner.email ? owner.name : "Organisation Goodissima";
  const type = queryValue(searchParams?.type) ?? "";
  const status = queryValue(searchParams?.status) ?? "";
  const search = queryValue(searchParams?.search) ?? "";
  const selectedId = queryValue(searchParams?.id);
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (status) params.set("status", status);
  if (search) params.set("search", search);

  const where = buildFeedbackWhere({ type, status, search });
  const feedback = await prisma.productFeedback.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      type: true,
      message: true,
      page: true,
      role: true,
      userId: true,
      caseId: true,
      templateId: true,
      browserInfo: true,
      environment: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      resolvedAt: true,
      adminNotes: true,
      attachments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          fileSize: true,
          width: true,
          height: true,
          createdAt: true,
        },
      },
    },
  });
  const selected = feedback.find((item) => item.id === selectedId) ?? feedback[0] ?? null;
  const browserRows = displayBrowserInfo(selected?.browserInfo);
  const exportHref = `/api/admin/feedback/export${params.toString() ? `?${params.toString()}` : ""}`;

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <DashboardBackLink className="mb-4" />
      <PlatformNavigation active="admin" organizationName={organizationName} />

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Administration · Feedback</p>
            <h1 className="mt-2 text-3xl font-bold">Revue des retours produit</h1>
            <p className="mt-2 max-w-3xl text-slate-600">
              Retours envoyés depuis l'application, avec contexte de page et métadonnées techniques limitées.
            </p>
          </div>
          <Link href={exportHref} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Exporter CSV
          </Link>
        </div>

        <form className="mt-6 grid gap-3 lg:grid-cols-[180px_180px_1fr_auto]" action="/administration/feedback">
          <select name="type" defaultValue={type} className="rounded-xl border px-3 py-2 text-sm">
            <option value="">Tous les types</option>
            {productFeedbackTypes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={status} className="rounded-xl border px-3 py-2 text-sm">
            <option value="">Tous les statuts</option>
            {productFeedbackStatuses.map((item) => (
              <option key={item} value={item}>
                {statusLabels[item]}
              </option>
            ))}
          </select>
          <input
            name="search"
            defaultValue={search}
            placeholder="Rechercher dans le message, la page ou les notes"
            className="rounded-xl border px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded-xl border px-4 py-2 text-sm font-medium text-slate-700">
            Filtrer
          </button>
        </form>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Retours</h2>
            <span className="text-sm text-slate-500">{feedback.length} affiché(s)</span>
          </div>
          <div className="mt-4 divide-y">
            {feedback.length === 0 ? (
              <p className="py-8 text-sm text-slate-500">Aucun feedback ne correspond aux filtres.</p>
            ) : (
              feedback.map((item) => {
                const itemParams = new URLSearchParams(params);
                itemParams.set("id", item.id);
                const active = selected?.id === item.id;
                return (
                  <Link
                    key={item.id}
                    href={`/administration/feedback?${itemParams.toString()}`}
                    className={active ? "block bg-slate-50 px-3 py-4" : "block px-3 py-4 transition hover:bg-slate-50"}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold">{item.type}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {statusLabels[item.status]}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-slate-700">{item.message}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {formatDate(item.createdAt)}
                      {item.attachments.length > 0 ? ` · ${item.attachments.length} capture(s)` : ""}
                    </p>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          {!selected ? (
            <p className="text-sm text-slate-500">Sélectionnez un feedback pour afficher le détail.</p>
          ) : (
            <div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-500">{selected.type}</p>
                  <h2 className="mt-1 text-2xl font-bold">Détail du feedback</h2>
                </div>
                <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                  {statusLabels[selected.status]}
                </span>
              </div>

              <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-800">
                <p className="whitespace-pre-wrap">{selected.message}</p>
              </div>

              <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-slate-500">Page</dt><dd className="mt-1 break-all font-medium">{selected.page ?? "Non renseignée"}</dd></div>
                <div><dt className="text-slate-500">Rôle</dt><dd className="mt-1 font-medium">{selected.role ?? "Non renseigné"}</dd></div>
                <div><dt className="text-slate-500">Environnement</dt><dd className="mt-1 font-medium">{selected.environment ?? "Non renseigné"}</dd></div>
                <div><dt className="text-slate-500">Créé le</dt><dd className="mt-1 font-medium">{formatDate(selected.createdAt)}</dd></div>
                <div><dt className="text-slate-500">Dossier</dt><dd className="mt-1 break-all font-medium">{selected.caseId ?? "Non lié"}</dd></div>
                <div><dt className="text-slate-500">Parcours</dt><dd className="mt-1 break-all font-medium">{selected.templateId ?? "Non lié"}</dd></div>
                <div><dt className="text-slate-500">Utilisateur</dt><dd className="mt-1 break-all font-medium">{selected.userId ?? "Visiteur ou non lié"}</dd></div>
                <div><dt className="text-slate-500">Résolu le</dt><dd className="mt-1 font-medium">{formatDate(selected.resolvedAt)}</dd></div>
              </dl>

              {browserRows.length > 0 ? (
                <section className="mt-5 rounded-xl border p-4">
                  <h3 className="text-sm font-semibold">Métadonnées navigateur</h3>
                  <dl className="mt-3 space-y-2 text-sm">
                    {browserRows.map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-slate-500">{label}</dt>
                        <dd className="mt-1 break-all font-medium">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ) : null}

              {selected.attachments.length > 0 ? (
                <section className="mt-5 rounded-xl border p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">Captures d'écran</h3>
                      <p className="text-xs text-slate-500">Cliquez sur une miniature pour l'agrandir.</p>
                    </div>
                    <span className="text-xs text-slate-500">{selected.attachments.length} fichier(s)</span>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {selected.attachments.map((attachment) => {
                      const fileHref = `/api/admin/feedback/attachments/${attachment.id}/file`;
                      const downloadHref = `${fileHref}?download=1`;

                      return (
                        <div key={attachment.id} className="rounded-xl border bg-slate-50 p-3">
                          <a href={fileHref} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border bg-white">
                            <img
                              src={fileHref}
                              alt={`Capture feedback ${attachment.fileName}`}
                              className="h-40 w-full object-contain"
                            />
                          </a>
                          <div className="mt-3 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-800">{attachment.fileName}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {attachment.mimeType} · {(attachment.fileSize / (1024 * 1024)).toFixed(2)} Mo
                              </p>
                            </div>
                            <a href={downloadHref} className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white">
                              Télécharger
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : (
                <section className="mt-5 rounded-xl border border-dashed p-4 text-sm text-slate-500">
                  Aucune capture jointe à ce feedback.
                </section>
              )}

              <form action={updateFeedbackAction} className="mt-6 space-y-4 rounded-xl border p-4">
                <input type="hidden" name="feedbackId" value={selected.id} />
                <div>
                  <label htmlFor="status" className="text-sm font-medium text-slate-700">Statut</label>
                  <select id="status" name="status" defaultValue={selected.status} className="mt-2 w-full rounded-xl border px-3 py-2 text-sm">
                    {productFeedbackStatuses.map((item) => (
                      <option key={item} value={item}>{statusLabels[item]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="adminNotes" className="text-sm font-medium text-slate-700">Notes administrateur</label>
                  <textarea
                    id="adminNotes"
                    name="adminNotes"
                    defaultValue={selected.adminNotes ?? ""}
                    maxLength={2000}
                    className="mt-2 min-h-32 w-full rounded-xl border px-3 py-2 text-sm"
                    placeholder="Décision, suivi, lien vers ticket interne..."
                  />
                </div>
                <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                  Enregistrer la revue
                </button>
              </form>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
