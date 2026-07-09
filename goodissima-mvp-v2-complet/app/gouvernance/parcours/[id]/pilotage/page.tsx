import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformNavigation } from "@/components/PlatformNavigation";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prepareGovernanceCommunicationSessionAction } from "@/lib/governance-communication-session-actions";
import { declareDocumentReceptionAction } from "@/lib/governance-document-receptions-actions";
import { prepareParticipantInvitationAction } from "@/lib/governance-participant-invitations-actions";
import { prepareGovernanceReviewAction } from "@/lib/governance-review-preparations-actions";
import {
  communicationChannelLabels,
  getGovernanceCommunicationSessionsForJourney,
} from "@/lib/governance-workspace-repository";
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
  messageDraft: string | null;
  status: "PREPARED_NOT_SENT";
  deliveryMode: "MANUAL_OUT_OF_BAND";
  manualDeliveryRequired: true;
  preparedAt: string;
  updatedAt: string;
  preparedById: string;
  automaticEmailSent: false;
  accessOpened: false;
  tokenGenerated: false;
  linkGenerated: false;
};

type DocumentReception = {
  receptionId: string;
  documentName: string;
  reference: string | null;
  note: string | null;
  status: "RECEIVED_DECLARED";
  receivedAt: string;
  receivedById: string;
  fileStored: false;
  automaticValidation: false;
};

type GovernanceReviewPreparation = {
  reviewPreparationId: string;
  status: "PREPARED_NOT_STARTED";
  reason: string;
  question: string;
  note: string | null;
  preparedAt: string;
  updatedAt: string;
  preparedById: string;
  meetingCreated: false;
  notificationSent: false;
  aiSummaryGenerated: false;
  automaticDecision: false;
  workflowStarted: false;
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
        messageDraft: text(row.messageDraft),
        status: "PREPARED_NOT_SENT" as const,
        deliveryMode: "MANUAL_OUT_OF_BAND" as const,
        manualDeliveryRequired: true as const,
        preparedAt,
        updatedAt: text(row.updatedAt) ?? preparedAt,
        preparedById,
        automaticEmailSent: false as const,
        accessOpened: false as const,
        tokenGenerated: false as const,
        linkGenerated: false as const,
      };
    })
    .filter((item): item is ParticipantInvitation => item !== null);
}

function defaultInvitationMessageDraft(input: { journeyTitle: string; participantRole: string }) {
  return [
    "Bonjour,",
    "",
    `Vous etes identifie comme participant attendu dans le parcours gouverne \"${input.journeyTitle}\".`,
    `Role attendu : ${input.participantRole}.`,
    "Cette invitation n'a pas ete envoyee automatiquement par Goodissima.",
    "Aucun acces n'est ouvert a ce stade.",
    "Merci de confirmer les modalites de participation avec le responsable du parcours.",
  ].join("\n");
}

function participantKey(name: string, role: string) {
  return `${name.trim().toLowerCase()}::${role.trim().toLowerCase()}`;
}

function documentReceptionsFrom(value: unknown): DocumentReception[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const row = asRecord(item);
      const receptionId = text(row.receptionId);
      const documentName = text(row.documentName);
      const receivedAt = text(row.receivedAt);
      const receivedById = text(row.receivedById);
      if (!receptionId || !documentName || !receivedAt || !receivedById) return null;

      return {
        receptionId,
        documentName,
        reference: text(row.reference),
        note: text(row.note),
        status: "RECEIVED_DECLARED" as const,
        receivedAt,
        receivedById,
        fileStored: false as const,
        automaticValidation: false as const,
      };
    })
    .filter((item): item is DocumentReception => item !== null);
}

function documentKey(name: string) {
  return name.trim().toLowerCase();
}

function preparedInvitationsCount(input: { participants: Actor[]; participantInvitations: ParticipantInvitation[] }) {
  const preparedInvitationKeys = new Set(
    input.participantInvitations.map((invitation) =>
      participantKey(invitation.participantName, invitation.participantRole),
    ),
  );

  return input.participants.filter((participant) => preparedInvitationKeys.has(participantKey(participant.name, participant.role)))
    .length;
}

function declaredReceptionsCount(input: { documents: ExpectedDocument[]; documentReceptions: DocumentReception[] }) {
  const declaredReceptionKeys = new Set(input.documentReceptions.map((reception) => documentKey(reception.documentName)));

  return input.documents.filter((document) => declaredReceptionKeys.has(documentKey(document.name))).length;
}

function governedJourneyStatusLabel(input: {
  totalParticipants: number;
  preparedInvitationsCount: number;
  totalDocuments: number;
  declaredReceptionsCount: number;
  preparedReviewsCount: number;
  humanValidated: boolean;
}) {
  if (!input.humanValidated) return "À valider humainement";
  if (input.totalParticipants === 0 && input.totalDocuments === 0 && input.preparedReviewsCount === 0) {
    return "Préparation initiale";
  }

  const everyParticipantHasPreparedInvitation =
    input.totalParticipants === 0 || input.preparedInvitationsCount === input.totalParticipants;
  const everyDocumentHasDeclaredReception =
    input.totalDocuments === 0 || input.declaredReceptionsCount === input.totalDocuments;

  if (everyParticipantHasPreparedInvitation && everyDocumentHasDeclaredReception) {
    return "Préparation structurée";
  }

  return "Préparation en cours";
}

function governedJourneySummary(input: {
  participants: Actor[];
  participantInvitations: ParticipantInvitation[];
  documents: ExpectedDocument[];
  documentReceptions: DocumentReception[];
  governanceReviewPreparations: GovernanceReviewPreparation[];
  humanValidated: boolean;
}) {
  const totalParticipants = input.participants.length;
  const invitationsPrepared = preparedInvitationsCount({
    participants: input.participants,
    participantInvitations: input.participantInvitations,
  });
  const totalDocuments = input.documents.length;
  const receptionsDeclared = declaredReceptionsCount({
    documents: input.documents,
    documentReceptions: input.documentReceptions,
  });
  const preparedReviewsCount = input.governanceReviewPreparations.length;

  return {
    totalParticipants,
    preparedInvitationsCount: invitationsPrepared,
    totalDocuments,
    declaredReceptionsCount: receptionsDeclared,
    preparedReviewsCount,
    humanValidated: input.humanValidated,
    statusLabel: governedJourneyStatusLabel({
      totalParticipants,
      preparedInvitationsCount: invitationsPrepared,
      totalDocuments,
      declaredReceptionsCount: receptionsDeclared,
      preparedReviewsCount,
      humanValidated: input.humanValidated,
    }),
  };
}

function governanceReviewPreparationsFrom(value: unknown): GovernanceReviewPreparation[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const row = asRecord(item);
      const reviewPreparationId = text(row.reviewPreparationId);
      const reason = text(row.reason);
      const question = text(row.question);
      const preparedAt = text(row.preparedAt);
      const preparedById = text(row.preparedById);
      if (!reviewPreparationId || !reason || !question || !preparedAt || !preparedById) return null;

      return {
        reviewPreparationId,
        status: "PREPARED_NOT_STARTED" as const,
        reason,
        question,
        note: text(row.note),
        preparedAt,
        updatedAt: text(row.updatedAt) ?? preparedAt,
        preparedById,
        meetingCreated: false as const,
        notificationSent: false as const,
        aiSummaryGenerated: false as const,
        automaticDecision: false as const,
        workflowStarted: false as const,
      };
    })
    .filter((item): item is GovernanceReviewPreparation => item !== null);
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
  const workspaceDisplay =
    text(metadata.workspaceName) ??
    text(metadata.workspaceSlug) ??
    text(creationPlan.workspaceId) ??
    text(metadata.workspaceId) ??
    "Workspace non rattaché en V1";
  const attachedWorkspaceId = formTemplate.relationTemplate?.workspaceId ?? null;
  const workspaceCategory = text(metadata.workspaceCategory);
  const workspacePersistence = text(metadata.workspacePersistence);
  const source = text(creationPlan.source) ?? text(metadata.source) ?? "Création V1";

  const participants = actorsFrom(creationPlan.participants ?? creationPlan.actors);
  const documentsFromPlan = documentsFrom(creationPlan.documents ?? creationPlan.expectedDocuments);
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
  const documentReceptions = documentReceptionsFrom(metadata.documentReceptions);
  const governanceReviewPreparations = governanceReviewPreparationsFrom(metadata.governanceReviewPreparations);
  const humanValidated = validation.humanValidated === true;
  const summary = governedJourneySummary({
    participants,
    participantInvitations,
    documents,
    documentReceptions,
    governanceReviewPreparations,
    humanValidated,
  });
  const communicationSessions = formTemplate.relationTemplate?.id
    ? await getGovernanceCommunicationSessionsForJourney({
        ownerId: owner.id,
        relationTemplateId: formTemplate.relationTemplate.id,
      })
    : [];
  const communicationCapabilities = [
    { channelType: "VOICE_IP", label: communicationChannelLabels.VOICE_IP },
    { channelType: "VIDEO_IP", label: communicationChannelLabels.VIDEO_IP },
    { channelType: "SCREEN_SHARE", label: communicationChannelLabels.SCREEN_SHARE },
  ] as const;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PlatformNavigation active="governance" organizationName={organizationName} />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/gouvernance" className="text-sm font-semibold text-slate-600 underline underline-offset-4">
          Retour à la gouvernance
        </Link>
        <div className="flex flex-wrap gap-2">
          <Link href="/annuaire" className="rounded-lg border px-4 py-2 text-sm font-semibold text-slate-700">
            Annuaire Goodissima V1
          </Link>
          <Link href="/gouvernance/nouveau" className="rounded-lg border px-4 py-2 text-sm font-semibold text-slate-700">
            Créer un autre parcours
          </Link>
        </div>
      </div>

      <p className="mt-2 text-xs text-slate-500">
        L'annuaire Goodissima est transversal ; en V1, il ne crée pas encore de contact global automatiquement depuis ce cockpit.
      </p>

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Synthèse du parcours gouverné</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Cette synthèse est calculée localement à partir des informations déclarées.
            </p>
          </div>
          <span className="w-fit rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">
            {summary.statusLabel}
          </span>
        </div>

        <div className="mt-5 grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Validation humaine</p>
            <p className="mt-1 font-bold text-slate-950">{summary.humanValidated ? "Validée" : "Non validée"}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Participants</p>
            <p className="mt-1 font-bold text-slate-950">
              {summary.preparedInvitationsCount} / {summary.totalParticipants} invitations préparées
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Documents</p>
            <p className="mt-1 font-bold text-slate-950">
              {summary.declaredReceptionsCount} / {summary.totalDocuments} réceptions déclarées
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Revues</p>
            <p className="mt-1 font-bold text-slate-950">{summary.preparedReviewsCount} revue(s) préparée(s)</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Automatisations</p>
            <p className="mt-1 font-bold text-slate-950">Aucune automatisation active en V1</p>
          </div>
        </div>

        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
          Goodissima ne vérifie pas automatiquement les documents, n’envoie pas les invitations et ne lance pas les revues.
        </p>
      </section>

      <section className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-950">Besoin initial validé</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{initialNeed}</p>
      </section>

      <section className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500">Workspace actuel</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">{workspaceDisplay}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Le rattachement manuel d'un ancien parcours se fait depuis la page Gouvernance.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {workspaceCategory ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                Catégorie : {workspaceCategory}
              </span>
            ) : null}
            {workspacePersistence ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                {workspacePersistence}
              </span>
            ) : null}
          </div>
        </div>
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
                const messageDraft =
                  invitation?.messageDraft ??
                  defaultInvitationMessageDraft({ journeyTitle: title, participantRole: participant.role });

                return (
                <article key={`${participant.name}-${index}`} className="rounded-lg border bg-slate-50 p-4">
                  <p className="font-semibold text-slate-950">{participant.name}</p>
                  <p className="mt-1 text-sm text-slate-600">{participant.role}</p>
                  {invitation ? (
                    <div className="mt-4 space-y-3">
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                        <p className="font-bold">Invitation preparee - non envoyee automatiquement</p>
                        <p className="mt-1 text-xs font-semibold text-emerald-800">
                          Statut metadata : {invitation.status} - transmission manuelle requise - aucun email automatique.
                        </p>
                        {invitation.email ? <p className="mt-2 text-sm">Email prepare : {invitation.email}</p> : null}
                        {invitation.note ? <p className="mt-1 text-sm">Note : {invitation.note}</p> : null}
                        <p className="mt-2 text-xs text-emerald-800">
                          Prepare le {formatDate(invitation.preparedAt)}. Derniere mise a jour : {formatDate(invitation.updatedAt)}.
                        </p>
                      </div>
                      <div className="rounded-lg border bg-white p-3">
                        <p className="text-sm font-bold text-slate-950">Message a transmettre manuellement</p>
                        <textarea
                          readOnly
                          value={messageDraft}
                          className="mt-2 min-h-40 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800"
                        />
                      </div>
                      <form action={prepareParticipantInvitationAction} className="rounded-lg border bg-white p-3">
                        <input type="hidden" name="formTemplateId" value={formTemplate.id} />
                        <input type="hidden" name="participantName" value={participant.name} />
                        <input type="hidden" name="participantRole" value={participant.role} />
                        <p className="text-sm font-bold text-slate-950">Modifier la preparation</p>
                        <div className="mt-3 grid gap-3">
                          <label className="text-xs font-semibold text-slate-600">
                            Email optionnel
                            <input
                              name="optionalEmail"
                              type="email"
                              defaultValue={invitation.email ?? ""}
                              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950"
                              placeholder="Non transmis automatiquement"
                            />
                          </label>
                          <label className="text-xs font-semibold text-slate-600">
                            Note optionnelle
                            <textarea
                              name="optionalNote"
                              defaultValue={invitation.note ?? ""}
                              className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950"
                              placeholder="Message interne de preparation"
                            />
                          </label>
                          <label className="text-xs font-semibold text-slate-600">
                            Brouillon de message
                            <textarea
                              name="messageDraft"
                              defaultValue={messageDraft}
                              className="mt-1 min-h-40 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950"
                            />
                          </label>
                        </div>
                        <button type="submit" className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">
                          Mettre a jour sans transmettre
                        </button>
                        <p className="mt-2 text-xs text-slate-500">
                          V1 : ce message est uniquement prepare pour copie ou transmission manuelle. Goodissima n'envoie pas
                          l'invitation, ne genere pas de lien et n'ouvre aucun acces automatiquement.
                        </p>
                      </form>
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
                        <label className="text-xs font-semibold text-slate-600">
                          Brouillon de message
                          <textarea
                            name="messageDraft"
                            defaultValue={messageDraft}
                            className="mt-1 min-h-40 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950"
                          />
                        </label>
                      </div>
                      <button type="submit" className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">
                        Preparer sans envoyer
                      </button>
                      <p className="mt-2 text-xs text-slate-500">
                        V1 : ce message est uniquement prepare pour copie ou transmission manuelle. Goodissima n'envoie pas
                        l'invitation, ne genere pas de lien et n'ouvre aucun acces automatiquement.
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
              {documents.map((document, index) => {
                const reception = documentReceptions.find((item) => documentKey(item.documentName) === documentKey(document.name));

                return (
                <article key={`${document.name}-${index}`} className="rounded-lg border bg-slate-50 p-4">
                  <p className="font-semibold text-slate-950">{document.name}</p>
                  <p className="mt-1 text-sm text-slate-600">{document.reason}</p>
                  {reception ? (
                    <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                      <p className="font-bold">Reception declaree - fichier non stocke en V1</p>
                      <p className="mt-1 text-xs font-semibold text-emerald-800">
                        Statut metadata : {reception.status} - fichier stocke : non - validation automatique : non
                      </p>
                      {reception.reference ? <p className="mt-2 text-sm">Reference : {reception.reference}</p> : null}
                      {reception.note ? <p className="mt-1 text-sm">Note : {reception.note}</p> : null}
                      <p className="mt-2 text-xs text-emerald-800">Declare le {formatDate(reception.receivedAt)}.</p>
                    </div>
                  ) : (
                    <form action={declareDocumentReceptionAction} className="mt-4 rounded-lg border bg-white p-3">
                      <input type="hidden" name="formTemplateId" value={formTemplate.id} />
                      <input type="hidden" name="documentName" value={document.name} />
                      <p className="text-sm font-bold text-slate-950">Declarer une reception</p>
                      <div className="mt-3 grid gap-3">
                        <label className="text-xs font-semibold text-slate-600">
                          Reference optionnelle
                          <input
                            name="optionalReference"
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950"
                            placeholder="Reference externe ou interne"
                          />
                        </label>
                        <label className="text-xs font-semibold text-slate-600">
                          Note optionnelle
                          <textarea
                            name="optionalNote"
                            className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950"
                            placeholder="Contexte de reception, sans fichier stocke"
                          />
                        </label>
                      </div>
                      <button type="submit" className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">
                        Declarer sans stocker
                      </button>
                      <p className="mt-2 text-xs text-slate-500">
                        Metadata V1 uniquement : aucun fichier stocke, aucune validation automatique, aucun workflow.
                      </p>
                    </form>
                  )}
                  {!reception ? (
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    {document.required ? "Obligatoire" : "Optionnel"} · statut V1 : attendu, non reçu.
                  </p>
                  ) : (
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    {document.required ? "Obligatoire" : "Optionnel"} - statut V1 : reception declaree, fichier non stocke en V1.
                  </p>
                  )}
                </article>
                );
              })}
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

      <section className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Communications sécurisées</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Préparation gouvernée uniquement : aucun appel, visio ou partage d'écran n'est démarré automatiquement.
            </p>
          </div>
          <span className="w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-200">
            Socle persistant V1
          </span>
        </div>

        {communicationSessions.length > 0 ? (
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {communicationSessions.map((session) => (
              <article key={session.id} className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">{session.channelLabel}</p>
                    <h3 className="mt-1 font-bold text-emerald-950">{session.title}</h3>
                  </div>
                  <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-800 ring-1 ring-emerald-200">
                    {session.statusLabel}
                  </span>
                </div>
                {session.purpose ? <p className="mt-3 text-sm text-emerald-950">Objectif : {session.purpose}</p> : null}
                {session.note ? <p className="mt-2 text-sm text-emerald-950">Note : {session.note}</p> : null}
                {session.scheduledAt ? (
                  <p className="mt-2 text-sm text-emerald-950">Date prévue : {formatDate(session.scheduledAt)}</p>
                ) : null}
                {session.externalUrl ? (
                  <p className="mt-2 break-words text-sm text-emerald-950">
                    Lien externe manuel : {session.externalUrl}
                  </p>
                ) : null}
                <div className="mt-3 rounded-lg bg-white/80 p-3 text-xs font-semibold text-emerald-900">
                  <p>Provider : {session.providerLabel}</p>
                  <p className="mt-1">Transcription : désactivée</p>
                  <p className="mt-1">Enregistrement : désactivé</p>
                  <p className="mt-1">Notification automatique : non</p>
                  <p className="mt-1">Token généré : non</p>
                  <p className="mt-1">Accès ouvert : non</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-lg border bg-slate-50 p-4 text-sm text-slate-600">
            Aucune communication sécurisée n'est préparée pour ce parcours.
          </p>
        )}

        {attachedWorkspaceId ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {communicationCapabilities.map((capability) => (
              <details key={capability.channelType} className="rounded-lg border bg-slate-50 p-4">
                <summary className="cursor-pointer text-sm font-bold text-slate-950">
                  Préparer - {capability.label}
                </summary>
                <form action={prepareGovernanceCommunicationSessionAction} className="mt-4 space-y-3">
                  <input type="hidden" name="formTemplateId" value={formTemplate.id} />
                  <input type="hidden" name="workspaceId" value={attachedWorkspaceId} />
                  <input type="hidden" name="channelType" value={capability.channelType} />
                  <label className="block text-xs font-semibold text-slate-600">
                    Titre
                    <input
                      name="title"
                      required
                      maxLength={140}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950"
                      placeholder={capability.label}
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-600">
                    Objectif
                    <textarea
                      name="purpose"
                      maxLength={500}
                      className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-600">
                    Date optionnelle
                    <input
                      name="scheduledAt"
                      type="datetime-local"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-600">
                    Note
                    <textarea
                      name="note"
                      maxLength={500}
                      className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-600">
                    Lien externe manuel optionnel
                    <input
                      name="externalUrl"
                      type="url"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950"
                      placeholder="https://..."
                    />
                  </label>
                  <button type="submit" className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">
                    Préparer
                  </button>
                  <p className="text-xs text-slate-500">
                    Le lien externe reste manuel et n'est jamais envoyé automatiquement par Goodissima.
                  </p>
                </form>
              </details>
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Rattachez d'abord ce parcours à un Workspace produit depuis la page Gouvernance pour préparer une communication.
          </p>
        )}

        <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
          V1 : Goodissima prépare et gouverne la session. Le démarrage média, les tokens temporaires, LiveKit et l'envoi
          aux participants seront ajoutés dans un sprint dédié avec consentement explicite.
        </p>
      </section>

      <section className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Revue de gouvernance</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Préparation humaine uniquement : aucune réunion, notification, synthèse IA, décision ou action n'est déclenchée.
            </p>
          </div>
          <span className="w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-200">
            Metadata-first V1.2
          </span>
        </div>

        {governanceReviewPreparations.length > 0 ? (
          <div className="mt-5 space-y-3">
            {governanceReviewPreparations.map((review) => (
              <article key={review.reviewPreparationId} className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-bold text-emerald-950">Revue préparée - non lancée automatiquement</p>
                <div className="mt-3 grid gap-3 text-sm lg:grid-cols-2">
                  <div className="rounded-lg bg-white/80 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Motif</p>
                    <p className="mt-1 text-emerald-950">{review.reason}</p>
                  </div>
                  <div className="rounded-lg bg-white/80 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Question à trancher</p>
                    <p className="mt-1 text-emerald-950">{review.question}</p>
                  </div>
                </div>
                {review.note ? <p className="mt-3 text-sm text-emerald-950">Note : {review.note}</p> : null}
                <p className="mt-3 text-xs font-semibold text-emerald-800">
                  Préparée le {formatDate(review.preparedAt)}. Dernière mise à jour : {formatDate(review.updatedAt)}.
                </p>
                <div className="mt-3 grid gap-2 text-xs font-semibold text-emerald-900 sm:grid-cols-2 lg:grid-cols-5">
                  <p className="rounded-lg bg-white/80 px-3 py-2">Réunion créée : non</p>
                  <p className="rounded-lg bg-white/80 px-3 py-2">Notification envoyée : non</p>
                  <p className="rounded-lg bg-white/80 px-3 py-2">Synthèse IA générée : non</p>
                  <p className="rounded-lg bg-white/80 px-3 py-2">Décision automatique : non</p>
                  <p className="rounded-lg bg-white/80 px-3 py-2">Workflow lancé : non</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-lg border bg-slate-50 p-4 text-sm text-slate-600">
            Aucune revue de gouvernance n'est préparée pour ce parcours.
          </p>
        )}

        <form action={prepareGovernanceReviewAction} className="mt-5 rounded-lg border bg-slate-50 p-4">
          <input type="hidden" name="formTemplateId" value={formTemplate.id} />
          <p className="text-sm font-bold text-slate-950">Préparer une revue de gouvernance</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600">
              Motif
              <input
                name="reviewReason"
                required
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950"
                placeholder="Ex. arbitrage humain, point de blocage, décision à préparer"
              />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Question à trancher
              <input
                name="reviewQuestion"
                required
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950"
                placeholder="Question précise à examiner manuellement"
              />
            </label>
            <label className="text-xs font-semibold text-slate-600 lg:col-span-2">
              Note optionnelle
              <textarea
                name="optionalNote"
                className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950"
                placeholder="Contexte utile pour la préparation humaine"
              />
            </label>
          </div>
          <button type="submit" className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">
            Préparer sans lancer
          </button>
          <p className="mt-2 text-xs text-slate-500">
            V1 : cette revue est uniquement préparée. Goodissima ne crée pas de réunion, ne notifie personne,
            ne génère pas de synthèse IA et ne prend aucune décision automatiquement.
          </p>
        </form>
      </section>

      <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        <h2 className="font-bold">Limite V1 explicite</h2>
        <p className="mt-2 leading-relaxed">
          Cette salle de pilotage affiche le cadrage validé et les éléments de préparation du parcours. V1 : les messages
          d'invitation sont uniquement préparés pour copie ou transmission manuelle. Goodissima n'envoie pas l'invitation,
          ne génère pas de lien et n'ouvre aucun accès automatiquement. Les revues de gouvernance sont uniquement préparées :
          Goodissima ne crée pas de réunion, ne notifie personne, ne génère pas de synthèse IA et ne prend aucune décision
          automatiquement. Les communications sécurisées et dépôts documentaires interactifs ne sont pas activés dans ce cockpit minimal.
        </p>
        <p className="mt-2 text-xs">
          Source : {source} · Workspace : {workspaceDisplay}
        </p>
      </section>
    </main>
  );
}
