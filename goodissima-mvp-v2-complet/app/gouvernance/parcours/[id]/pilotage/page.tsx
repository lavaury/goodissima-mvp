import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformNavigation } from "@/components/PlatformNavigation";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prepareParticipantInvitationAction } from "@/lib/governance-participant-invitations-actions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Actor = {
  name: string;
  role: string;
};

type ExpectedDocument = {
  name: string;
  reason: string;
  required: boolean;
};

type FirstAction = {
  title: string;
  owner: string;
  dueHint: string | undefined;
};

type ParticipantInvitation = {
  invitationId: string;
  participantName: string;
  participantRole: string;
  email: string | null;
  note: string | null;
  status: "PREPARED_NOT_SENT";
  preparedAt: string;
  preparedById: string;
  automaticEmailSent: false;
  accessOpened: false;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function textArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(text).filter((item): item is string => Boolean(item));
}

function actorsFrom(value: unknown): Actor[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const row = asRecord(item);
      const name = text(row.name);
      const role = text(row.role) ?? "Participant attendu";
      return name ? { name, role } : null;
    })
    .filter((item): item is Actor => Boolean(item));
}

function documentsFrom(value: unknown): ExpectedDocument[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const row = asRecord(item);
      const name = text(row.name);
      const reason = text(row.reason) ?? "Document attendu dans le cadrage validé.";
      const required = row.required === false ? false : true;
      return name ? { name, reason, required } : null;
    })
    .filter((item): item is ExpectedDocument => Boolean(item));
}

function actionsFrom(value: unknown): FirstAction[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const row = asRecord(item);
      const title = text(row.title);
      const owner = text(row.owner) ?? "Créateur du parcours";
      const dueHint = text(row.dueHint) ?? undefined;
      return title ? { title, owner, dueHint } : null;
    })
    .filter((item): item is FirstAction => item !== null) as FirstAction[];
}

function invitationsFrom(value: unknown): ParticipantInvitation[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const row = asRecord(item);
      const invitationId = text(row.invitationId);
      const participantName = text(row.participantName);
      const participantRole = text(row.participantRole);
      const preparedAt = text(row.preparedAt);
      const preparedById = text(row.preparedById);
      if (!invitationId || !participantName || !participantRole || !preparedAt || !preparedById) return null;

      return {
        invitationId,
        participantName,
        participantRole,
        email: text(row.email),
        note: text(row.note),
        status: "PREPARED_NOT_SENT" as const,
        preparedAt,
        preparedById,
        automaticEmailSent: false as const,
        accessOpened: false as const,
      };
    })
    .filter((item): item is ParticipantInvitation => item !== null);
}

function participantKey(name: string, role: string) {
  return `${name.trim().toLowerCase()}::${role.trim().toLowerCase()}`;
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "Date non disponible";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "Date non disponible";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default async function GovernedJourneyPilotagePage({ params }: { params: { id: string } }) {
  const owner = await getCurrentPrismaUser();
  const organizationName = owner.name && owner.name !== owner.email ? owner.name : "Organisation Goodissima";

  const formTemplate = await prisma.formTemplate.findUnique({
    where: { id: params.id },
    include: {
      fields: { orderBy: [{ step: "asc" }, { position: "asc" }] },
      relationTemplate: {
        include: {
          versions: {
            orderBy: { version: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  if (!formTemplate) notFound();

  const version = formTemplate.relationTemplate?.versions[0];
  const snapshot = asRecord(version?.snapshot);
  const metadata = asRecord(snapshot.metadata);
  const creationPlan = asRecord(metadata.creationPlan);
  const validation = asRecord(metadata.humanValidation);

  const title = text(creationPlan.title) ?? formTemplate.name;
  const objective = text(creationPlan.objective) ?? formTemplate.description ?? "Objectif non renseigné.";
  const initialNeed = text(creationPlan.initialNeed) ?? formTemplate.description ?? "Besoin initial non renseigné.";
  const workspaceId = text(creationPlan.workspaceId) ?? text(metadata.workspaceId) ?? "Workspace non rattaché en V1";
  const source = text(creationPlan.source) ?? text(metadata.source) ?? "Création V1";

  const participants = actorsFrom(creationPlan.actors);
  const documentsFromPlan = documentsFrom(creationPlan.expectedDocuments);
  const documents =
    documentsFromPlan.length > 0
      ? documentsFromPlan
      : formTemplate.fields
          .filter((field) => field.type === "FILE")
          .map((field) => ({
            name: field.label,
            reason: "Champ documentaire créé pour ce parcours.",
            required: field.required,
          }));

  const confidentialityRules = textArray(creationPlan.confidentialityRules);
  const firstActions = actionsFrom(creationPlan.firstActions);
  const participantInvitations = invitationsFrom(metadata.participantInvitations);
  const humanValidated = validation.humanValidated === true;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PlatformNavigation active="dashboard" organizationName={organizationName} />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/gouvernance" className="text-sm font-semibold text-slate-600 underline underline-offset-4">
          Retour à la gouvernance
        </Link>
        <Link href="/gouvernance/nouveau" className="rounded-lg border px-4 py-2 text-sm font-semibold text-slate-700">
          Créer un autre parcours
        </Link>
      </div>

      <section className="mt-4 rounded-lg border bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-[#247f88]">Pilotage V1 · préparation read-only</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">{title}</h1>
        <p className="mt-3 max-w-4xl text-sm leading-relaxed text-slate-700">{objective}</p>

        <div className="mt-5 grid gap-3 text-sm md:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Statut</p>
            <p className="mt-1 font-bold text-slate-950">Préparation</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Validation humaine</p>
            <p className="mt-1 font-bold text-slate-950">{humanValidated ? "Enregistrée" : "Non retrouvée"}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Créé le</p>
            <p className="mt-1 font-bold text-slate-950">{formatDate(version?.createdAt)}</p>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-950">Besoin initial validé</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{initialNeed}</p>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Participants attendus</h2>
          {participants.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Aucun participant attendu n’a été renseigné.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {participants.map((participant, index) => {
                const invitation = participantInvitations.find(
                  (item) =>
                    participantKey(item.participantName, item.participantRole) ===
                    participantKey(participant.name, participant.role),
                );

                return (
                <article key={`${participant.name}-${index}`} className="rounded-lg border bg-slate-50 p-4">
                  <p className="font-semibold text-slate-950">{participant.name}</p>
                  <p className="mt-1 text-sm text-slate-600">{participant.role}</p>
                  {invitation ? (
                    <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                      <p className="font-bold">Invitation preparee - non envoyee automatiquement</p>
                      <p className="mt-1 text-xs font-semibold text-emerald-800">
                        Statut metadata : {invitation.status} - acces ouvert : non - email envoye : non
                      </p>
                      {invitation.email ? <p className="mt-2 text-sm">Email prepare : {invitation.email}</p> : null}
                      {invitation.note ? <p className="mt-1 text-sm">Note : {invitation.note}</p> : null}
                      <p className="mt-2 text-xs text-emerald-800">Prepare le {formatDate(invitation.preparedAt)}.</p>
                    </div>
                  ) : (
                    <form action={prepareParticipantInvitationAction} className="mt-4 rounded-lg border bg-white p-3">
                      <input type="hidden" name="formTemplateId" value={formTemplate.id} />
                      <input type="hidden" name="participantName" value={participant.name} />
                      <input type="hidden" name="participantRole" value={participant.role} />
                      <p className="text-sm font-bold text-slate-950">Preparer une invitation privee</p>
                      <div className="mt-3 grid gap-3">
                        <label className="text-xs font-semibold text-slate-600">
                          Email optionnel
                          <input
                            name="optionalEmail"
                            type="email"
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950"
                            placeholder="Non envoye automatiquement"
                          />
                        </label>
                        <label className="text-xs font-semibold text-slate-600">
                          Note optionnelle
                          <textarea
                            name="optionalNote"
                            className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950"
                            placeholder="Message interne de preparation"
                          />
                        </label>
                      </div>
                      <button type="submit" className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">
                        Preparer sans envoyer
                      </button>
                      <p className="mt-2 text-xs text-slate-500">
                        Metadata V1 uniquement : aucun email, aucun lien d'acces, aucun contact automatique.
                      </p>
                    </form>
                  )}
                  <p className="mt-2 text-xs font-semibold text-slate-500">Statut V1 : attendu, non contacté automatiquement.</p>
                </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Documents attendus</h2>
          {documents.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Aucun document attendu n’a été renseigné.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {documents.map((document, index) => (
                <article key={`${document.name}-${index}`} className="rounded-lg border bg-slate-50 p-4">
                  <p className="font-semibold text-slate-950">{document.name}</p>
                  <p className="mt-1 text-sm text-slate-600">{document.reason}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    {document.required ? "Obligatoire" : "Optionnel"} · statut V1 : attendu, non reçu.
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Règles de confidentialité</h2>
          {confidentialityRules.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Aucune règle spécifique n’a été renseignée.</p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              {confidentialityRules.map((rule, index) => (
                <li key={`${rule}-${index}`} className="rounded-lg bg-slate-50 p-3">
                  {rule}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Premières actions</h2>
          {firstActions.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Aucune première action n’a été renseignée.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {firstActions.map((action, index) => (
                <article key={`${action.title}-${index}`} className="rounded-lg border bg-slate-50 p-4">
                  <p className="font-semibold text-slate-950">{action.title}</p>
                  <p className="mt-1 text-sm text-slate-600">Responsable : {action.owner}</p>
                  {action.dueHint ? <p className="mt-1 text-sm text-slate-500">Échéance : {action.dueHint}</p> : null}
                  <p className="mt-2 text-xs font-semibold text-slate-500">Statut V1 : à démarrer.</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        <h2 className="font-bold">Limite V1 explicite</h2>
        <p className="mt-2 leading-relaxed">
          Cette salle de pilotage affiche le cadrage validé et les éléments de préparation du parcours. Les invitations privées,
          communications sécurisées, revues de gouvernance et dépôts documentaires interactifs ne sont pas activés dans ce cockpit minimal.
        </p>
        <p className="mt-2 text-xs">
          Source : {source} · Workspace : {workspaceId}
        </p>
      </section>
    </main>
  );
}
