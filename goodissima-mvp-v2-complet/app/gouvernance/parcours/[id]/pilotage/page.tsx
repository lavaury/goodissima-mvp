import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformNavigation } from "@/components/PlatformNavigation";
import { GovernedJourneyGuestAccessPanel } from "@/components/GovernedJourneyGuestAccessPanel";
import { RelationLiveKitMediaRoom } from "@/components/RelationLiveKitMediaRoom";
import { GovernedMeetingSubmitButton } from "@/components/GovernedMeetingSubmitButton";
import { ConfirmMeetingCancellationButton } from "@/components/ConfirmMeetingCancellationButton";
import { GovernanceReviewAIAssistant } from "@/components/GovernanceReviewAIAssistant";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prepareGovernanceMultiActorCommunicationAction } from "@/lib/governance-communication-session-actions";
import { authorizeGuestForGovernedMeetingAction, removeGuestFromGovernedMeetingAction } from "@/lib/governed-meeting-participant-actions";
import { cancelGovernedMeetingAction, updateGovernedMeetingScheduleAction } from "@/lib/governed-meeting-lifecycle-actions";
import { declareDocumentReceptionAction } from "@/lib/governance-document-receptions-actions";
import { prepareParticipantInvitationAction } from "@/lib/governance-participant-invitations-actions";
import { prepareGovernanceReviewAction } from "@/lib/governance-review-preparations-actions";
import {
  getGovernanceCommunicationOverview,
  governanceCommunicationChannelLabels,
} from "@/lib/governance-communication-session-repository";
import { getGovernanceCockpitConsolidation } from "@/lib/governance-cockpit-consolidation-repository";
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

function governedInvitationRoleLabel(role: string) {
  return ({ OTHER: "Participant invité", JUDGE: "Juge", EXPERT: "Expert", THIRD_PARTY: "Tiers", ASSOCIATION: "Association", FAMILY: "Famille", OBSERVER: "Observateur" } as Record<string, string>)[role] ?? "Participant invité";
}

function governedMeetingUserNote(note: string | null) {
  if (!note) return null;
  if (!note.includes("source: governance-multi-actor-v1")) return note;
  return note.split("\n").find((line) => line.startsWith("note: "))?.slice(6).trim() || null;
}

function governedMeetingSelectedPreparedIds(metadata: unknown, note: string | null) {
  const row = asRecord(metadata);
  if (Array.isArray(row.selectedParticipantInvitationIds)) return row.selectedParticipantInvitationIds.filter((id): id is string => typeof id === "string");
  const legacyLine = note?.split("\n").find((line) => line.startsWith("participantInvitationIds: "));
  return legacyLine ? legacyLine.slice("participantInvitationIds: ".length).split(",").map((id) => id.trim()).filter((id) => id && id !== "aucun") : [];
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

function governedRoleFromParticipant(role: string) {
  const normalized = role.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (normalized.includes("EXPERT")) return "EXPERT";
  if (normalized.includes("JUGE") || normalized.includes("JUDGE")) return "JUDGE";
  if (normalized.includes("ASSOCIATION")) return "ASSOCIATION";
  if (normalized.includes("FAMIL")) return "FAMILY";
  if (normalized.includes("OBSERV")) return "OBSERVER";
  if (normalized.includes("TIERS") || normalized.includes("THIRD")) return "THIRD_PARTY";
  return "OTHER";
}

function normalizedIdentity(value: string | null | undefined) {
  return (value ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function participantMatchesOrganizer(participantName: string, owner: { name: string | null; email: string }) {
  const participantIdentity = normalizedIdentity(participantName);
  return Boolean(participantIdentity) && [owner.name, owner.email]
    .map(normalizedIdentity)
    .filter(Boolean)
    .includes(participantIdentity);
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

export default async function GovernedJourneyPilotagePage({ params, searchParams }: { params: { id: string }; searchParams: { meetingPrepared?: string; similarMeetingId?: string } }) {
  const owner = await getCurrentPrismaUser();
  const organizationName = owner.name && owner.name !== owner.email ? owner.name : "Organisation Goodissima";

  const formTemplate = await prisma.formTemplate.findUnique({
    where: { id: params.id },
    include: {
      fields: { orderBy: [{ step: "asc" }, { position: "asc" }] },
      relationTemplate: {
        include: {
          relationCases: { select: { id: true, candidateName: true }, orderBy: { createdAt: "desc" } },
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
  const communicationOverview = formTemplate.relationTemplate?.id
    ? await getGovernanceCommunicationOverview({
        ownerId: owner.id,
        relationTemplateId: formTemplate.relationTemplate.id,
        workspaceId: attachedWorkspaceId,
        invitationPreparedCount: participantInvitations.length,
      })
    : {
        sessions: [],
        preparedCount: 0,
        completedCount: 0,
        expiredCount: 0,
        invitationPreparedCount: participantInvitations.length,
      };
  const communicationCapabilities = [
    { channelType: "VOICE_IP", label: governanceCommunicationChannelLabels.VOICE_IP },
    { channelType: "VIDEO_IP", label: governanceCommunicationChannelLabels.VIDEO_IP },
    { channelType: "SCREEN_SHARE", label: governanceCommunicationChannelLabels.SCREEN_SHARE },
  ] as const;
  const consolidation = await getGovernanceCockpitConsolidation({
    ownerId: owner.id,
    formTemplateId: formTemplate.id,
  });
  const governedInvitations = formTemplate.relationTemplate?.id
    ? await prisma.governedJourneyInvitation.findMany({
        where: { ownerId: owner.id, relationTemplateId: formTemplate.relationTemplate.id },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const meetingParticipants = communicationOverview.sessions.length > 0
    ? await prisma.governedMeetingParticipant.findMany({ where: { communicationSessionId: { in: communicationOverview.sessions.map((session) => session.id) } } })
    : [];
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PlatformNavigation active="governance" organizationName={organizationName} />
      {searchParams.meetingPrepared ? <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-emerald-950"><p className="font-bold">Réunion préparée : {searchParams.meetingPrepared}</p><p className="mt-1 text-sm">Vous pouvez maintenant l’ouvrir depuis sa carte.</p></div> : null}
      {searchParams.similarMeetingId ? <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950"><p className="font-bold">Une réunion similaire existe déjà.</p><a href={`#meeting-${searchParams.similarMeetingId}`} className="mt-2 inline-block text-sm font-bold underline">Voir la réunion existante</a></div> : null}

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

      {consolidation?.workspace ? (
        <section className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#247f88]">Vue consolidee du Workspace</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-950">{consolidation.workspace.name}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                V1 : cette vue consolide les objets reellement rattaches au Workspace. Les actions restent humaines :
                aucun email, notification, acces, media, transcription ou workflow n'est lance automatiquement.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                Rubrique : {consolidation.workspace.categoryLabel}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                Type : {consolidation.workspace.kindLabel}
              </span>
            </div>
          </div>

          <dl className="mt-5 grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Parcours gouvernes" value={consolidation.workspace.journeyCount} />
            <MetricCard label="Dossiers relationnels" value={consolidation.workspace.relationCaseCount} />
            <MetricCard label="Liens relationnels" value={consolidation.workspace.gLinkCount} />
            <MetricCard label="Communications" value={consolidation.workspace.communicationCount} />
          </dl>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600">Dossiers relationnels rattaches</h3>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600">
                  {consolidation.relationCases.length}
                </span>
              </div>
              {consolidation.relationCases.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">Aucun dossier relationnel rattache a ce Workspace.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {consolidation.relationCases.map((relationCase) => (
                    <article key={relationCase.id} className="rounded-lg bg-white p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold text-slate-950">{relationCase.candidateName || relationCase.candidateEmail}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {relationCase.gLinkTitle} - {relationCase.status} - {formatDate(relationCase.createdAt)}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            {relationCase.attachment === "DIRECT" ? "Rattachement direct" : "Associe via lien rattache"} - communications : {relationCase.communicationsCount}
                          </p>
                        </div>
                        <Link href={relationCase.href} className="w-fit rounded-lg border px-3 py-1.5 text-xs font-bold text-slate-700">
                          Ouvrir le dossier
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600">Liens relationnels rattaches</h3>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600">
                  {consolidation.gLinks.length}
                </span>
              </div>
              {consolidation.gLinks.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">Aucun lien relationnel rattache a ce Workspace.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {consolidation.gLinks.map((link) => (
                    <article key={link.id} className="flex flex-col gap-2 rounded-lg bg-white p-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold text-slate-950">{link.title}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          /l/{link.slug} - {link.status} - dossiers : {link.relationCaseCount}
                        </p>
                      </div>
                      <Link href={link.href} className="w-fit rounded-lg border px-3 py-1.5 text-xs font-bold text-slate-700">
                        Ouvrir le lien
                      </Link>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600">Communications consolidees</h3>
              <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-600">
                <span className="rounded-full bg-white px-2.5 py-1">Preparees : {consolidation.preparedCommunicationCount}</span>
                <span className="rounded-full bg-white px-2.5 py-1">Actives : {consolidation.activeCommunicationCount}</span>
                <span className="rounded-full bg-white px-2.5 py-1">Terminees : {consolidation.completedCommunicationCount}</span>
                <span className="rounded-full bg-white px-2.5 py-1">Expirees : {consolidation.expiredCommunicationCount}</span>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <p className="text-sm font-bold text-slate-950">Communications gouvernees preparees</p>
                {consolidation.governanceCommunications.length === 0 ? (
                  <p className="mt-2 rounded-lg bg-white p-3 text-sm text-slate-600">Aucune communication gouvernee preparee.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {consolidation.governanceCommunications.map((session) => (
                      <article key={session.id} className="rounded-lg bg-white p-3 text-sm">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{session.originLabel}</p>
                            <p className="mt-1 font-semibold text-slate-950">{session.channelLabel} - {session.title}</p>
                          </div>
                          <span className="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                            {session.statusLabel}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          Creee le {formatDate(session.createdAt)} - Mode : {session.providerLabel}
                        </p>
                        {session.status !== "COMPLETED" && session.status !== "CANCELLED" ? (
                          <div className="mt-3">
                            <p className="mb-2 text-xs text-slate-600">Cette réunion utilise la salle sécurisée du parcours. Les invités gouvernés rejoignent avec leur propre lien d’accès.</p>
                            <RelationLiveKitMediaRoom contextKind="governedJourney" governedJourneyId={formTemplate.id} actorKind="owner" available preferredSessionId={session.id} joinLabel={session.status === "REQUESTED" && session.provider === "LIVEKIT_PENDING" ? "Rejoindre cette réunion" : "Ouvrir cette réunion"} expectedParticipants={[
                              { identity: `owner:${owner.id}`, displayName: owner.name || owner.email, roleLabel: "Organisateur", accessKind: "compte Goodissima" },
                              ...meetingParticipants.filter((item) => item.communicationSessionId === session.id && item.status === "AUTHORIZED").map((item) => governedInvitations.find((invitation) => invitation.id === item.governedJourneyInvitationId)).filter((invitation) => invitation?.status === "ACTIVE" && !invitation.revokedAt && invitation.accessTokenExpiresAt > new Date()).map((invitation) => ({ identity: `guest:${invitation!.id}`, displayName: invitation!.displayName, roleLabel: governedInvitationRoleLabel(invitation!.role), accessKind: "invité gouverné" })),
                            ]} />
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm font-bold text-slate-950">Communications relationnelles reelles</p>
                {consolidation.relationCommunications.length === 0 ? (
                  <p className="mt-2 rounded-lg bg-white p-3 text-sm text-slate-600">Aucune communication relationnelle historisee.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {consolidation.relationCommunications.map((session) => (
                      <article key={session.id} className="rounded-lg bg-white p-3 text-sm">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{session.originLabel}</p>
                            <p className="mt-1 font-semibold text-slate-950">{session.channelLabel} - {session.title}</p>
                            {session.relationCaseHref && session.relationCaseLabel ? (
                              <Link href={session.relationCaseHref} className="mt-1 inline-block text-xs font-bold text-[#247f88] underline underline-offset-4">
                                {session.relationCaseLabel}
                              </Link>
                            ) : null}
                          </div>
                          <span className="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                            {session.statusLabel}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          Creee le {formatDate(session.createdAt)}
                          {session.endedAt ? ` - terminee le ${formatDate(session.endedAt)}` : ""}
                          {session.expiresAt ? ` - expiration ${formatDate(session.expiresAt)}` : ""}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-amber-900">Interventions humaines</h3>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-amber-900">
                {consolidation.humanInterventions.length}
              </span>
            </div>
            {consolidation.humanInterventions.length === 0 ? (
              <p className="mt-3 text-sm text-amber-900">Aucun signal d'intervention humaine consolide pour le moment.</p>
            ) : (
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {consolidation.humanInterventions.map((signal) => (
                  <article key={signal.id} className="rounded-lg bg-white p-3 text-sm">
                    <p className="font-bold text-slate-950">{signal.title}</p>
                    <p className="mt-1 text-slate-600">{signal.description}</p>
                    <p className="mt-2 text-xs font-semibold text-slate-500">Source : {signal.source}</p>
                    <Link href={signal.href} className="mt-2 inline-block text-xs font-bold text-[#247f88] underline underline-offset-4">
                      {signal.actionLabel}
                    </Link>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h2 className="text-xl font-bold text-amber-950">Vue consolidee du Workspace indisponible</h2>
          <p className="mt-2 text-sm leading-relaxed text-amber-900">
            Rattachez ce parcours gouverne a un Workspace produit depuis la page Gouvernance pour consolider les dossiers,
            liens et communications reellement associes.
          </p>
        </section>
      )}

      <section className="mt-6 rounded-lg border border-[#b9dfe2] bg-[#f5ffff] p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-950">Organisateur du parcours</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div><p className="text-xs font-semibold uppercase text-slate-500">Identité</p><p className="mt-1 font-semibold text-slate-950">{owner.name || owner.email}</p>{owner.name && owner.name !== owner.email ? <p className="text-xs text-slate-500">{owner.email}</p> : null}</div>
          <div><p className="text-xs font-semibold uppercase text-slate-500">Rôle</p><p className="mt-1 font-semibold text-slate-950">Organisateur</p></div>
          <div><p className="text-xs font-semibold uppercase text-slate-500">Accès</p><p className="mt-1 font-semibold text-slate-950">Accès via compte Goodissima</p></div>
        </div>
        <p className="mt-4 text-sm text-slate-700">L’organisateur pilote ce parcours depuis son compte. Aucun lien invité n’est nécessaire.</p>
      </section>

      <section className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-950">Communication sécurisée du parcours</h2>
        <p className="mt-2 text-sm text-slate-600">Vous êtes l’organisateur de ce parcours. Vous pouvez ouvrir la salle sécurisée depuis votre compte Goodissima. Les invités gouvernés pourront la rejoindre avec leur propre lien d’accès.</p>
        <div className="mt-4">
          <RelationLiveKitMediaRoom contextKind="governedJourney" governedJourneyId={formTemplate.id} actorKind="owner" available />
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Participants attendus</h2>
          <p className="mt-2 text-sm text-slate-600">Les accès invités gouvernés sont destinés aux personnes externes ou non authentifiées. Ne créez pas de lien invité pour l’organisateur.</p>
          <p className="mt-1 text-xs text-slate-500">Les liens invités gouvernés sont réservés aux personnes à qui vous souhaitez donner un accès limité au parcours. Goodissima ne transmet aucun lien automatiquement.</p>
          {participants.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Aucun participant attendu n’a été renseigné.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {participants.map((participant, index) => {
                const isOrganizer = participantMatchesOrganizer(participant.name, owner);
                const invitation = participantInvitations.find(
                  (item) =>
                    participantKey(item.participantName, item.participantRole) ===
                    participantKey(participant.name, participant.role),
                );
                const messageDraft =
                  invitation?.messageDraft ??
                  defaultInvitationMessageDraft({ journeyTitle: title, participantRole: participant.role });
                const participantGovernedInvitations = governedInvitations
                  .filter((access) => {
                    const accessMetadata = asRecord(access.metadata);
                    const linkedName = text(accessMetadata.participantName) ?? access.displayName;
                    const linkedRole = text(accessMetadata.participantRole);
                    return linkedName.toLowerCase() === participant.name.toLowerCase() &&
                      (!linkedRole || linkedRole.toLowerCase() === participant.role.toLowerCase());
                  })
                  .map((access) => ({ id: access.id, displayName: access.displayName, role: access.role,
                    status: access.status, expiresAt: access.accessTokenExpiresAt.toISOString(), relationCaseId: access.relationCaseId }));

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
                          Ce message est un brouillon à transmettre manuellement. Il ne crée pas d’accès.
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
                        Ce message est un brouillon à transmettre manuellement. Il ne crée pas d’accès.
                      </p>
                    </form>
                  )}
                  {isOrganizer ? (
                    <div className="mt-4 rounded-lg border border-[#b9dfe2] bg-[#f5ffff] p-4">
                      <p className="font-bold text-[#247f88]">Organisateur — accès via compte Goodissima</p>
                      <p className="mt-1 text-sm text-slate-600">L’organisateur n’a pas besoin de lien invité.</p>
                    </div>
                  ) : <GovernedJourneyGuestAccessPanel
                    formTemplateId={formTemplate.id}
                    participantName={participant.name}
                    participantRole={participant.role}
                    governedRole={governedRoleFromParticipant(participant.role)}
                    preparedEmail={invitation?.email}
                    invitations={participantGovernedInvitations}
                    relationCases={(formTemplate.relationTemplate?.relationCases ?? []).map((relationCase) => ({ id: relationCase.id, label: relationCase.candidateName || `Dossier ${relationCase.id}` }))}
                  />}
                  {!isOrganizer ? <p className="mt-2 text-xs text-slate-500">Si cette personne est en réalité l’organisateur déjà connecté, ne créez pas de lien invité.</p> : null}
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
            <h2 className="text-xl font-bold text-slate-950">Communications gouvernees</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Cette section prepare et trace les communications gouvernees du parcours. En V1, les communications distantes
              fonctionnelles sont disponibles dans les dossiers relationnels ; le multi-acteurs gouverne complet sera branche
              dans un sprint dedie.
            </p>
          </div>
          <span className="w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-200">
            Multi-acteurs prepare - transport V1 non branche
          </span>
        </div>

        <dl className="mt-5 grid gap-3 text-sm md:grid-cols-4">
          <MetricCard label="Preparees / en cours" value={communicationOverview.preparedCount} />
          <MetricCard label="Terminees" value={communicationOverview.completedCount} />
          <MetricCard label="Expirees" value={communicationOverview.expiredCount} />
          <MetricCard label="Invitations preparees" value={communicationOverview.invitationPreparedCount} />
        </dl>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-950">Participants attendus</p>
            {participants.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">Aucun participant attendu n'est present dans la metadata du parcours.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {participants.map((participant) => {
                  const invitation = participantInvitations.find(
                    (item) => participantKey(item.participantName, item.participantRole) === participantKey(participant.name, participant.role),
                  );

                  return (
                    <div key={participantKey(participant.name, participant.role)} className="rounded-lg bg-white px-3 py-2 text-sm">
                      <p className="font-semibold text-slate-950">{participant.name}</p>
                      <p className="text-slate-600">Role : {participant.role}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {invitation
                          ? "Invitation preparee - non envoyee automatiquement - aucun acces ouvert"
                          : "Invitation non preparee - aucun envoi automatique"}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-bold">Limite V1 obligatoire</p>
            <p className="mt-2 leading-relaxed">
              Le rattachement des dossiers relationnels aux Workspaces est visible dans la vue consolidee ci-dessus. Cette section
              reste dediee a la preparation gouvernee : elle ne demarre pas de media multi-acteurs depuis la gouvernance.
            </p>
          </div>
        </div>

        {attachedWorkspaceId ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {communicationCapabilities.map((capability) => (
              <details key={capability.channelType} className="rounded-lg border bg-slate-50 p-4">
                <summary className="cursor-pointer text-sm font-bold text-slate-950">
                  Preparer une communication - {capability.label}
                </summary>
                <form action={prepareGovernanceMultiActorCommunicationAction} className="mt-4 space-y-3">
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
                      placeholder={`${capability.label} gouvernee`}
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
                  <fieldset className="rounded-lg border border-slate-200 bg-white p-3">
                    <legend className="px-1 text-xs font-semibold text-slate-600">Participants à autoriser pour cette réunion</legend>
                    <p className="mb-2 text-xs text-slate-500">Cochez les personnes qui pourront rejoindre cette réunion précise. Chaque personne externe doit disposer de son propre accès invité gouverné.</p>
                    {participantInvitations.length === 0 ? (
                      <p className="text-xs text-slate-500">Aucune invitation preparee. La session restera liee au parcours sans envoi ni acces.</p>
                    ) : (
                      <div className="space-y-2">
                        {participantInvitations.map((invitation) => (
                          <label key={invitation.invitationId} className="flex gap-2 text-xs text-slate-700">
                            <input
                              type="checkbox"
                              name="participantInvitationIds"
                              value={invitation.invitationId}
                              className="mt-0.5"
                            />
                            <span>
                              <span className="font-semibold">{invitation.participantName}</span> - {invitation.participantRole}
                              <span className="block text-slate-500">Preparee / non envoyee / aucun acces ouvert</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </fieldset>
                  <label className="block text-xs font-semibold text-slate-600">
                    Note
                    <textarea
                      name="note"
                      maxLength={500}
                      className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950"
                    />
                  </label>
                  <GovernedMeetingSubmitButton />
                  <p className="text-xs text-slate-500">
                    Goodissima prépare la réunion et ses autorisations. Aucun lien n’est transmis automatiquement, aucun média ne démarre.
                  </p>
                </form>
              </details>
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Rattachez d'abord ce parcours a un Workspace produit depuis la page Gouvernance pour preparer une communication.
          </p>
        )}

        {communicationOverview.sessions.length > 0 ? (
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {communicationOverview.sessions.map((session) => (
              <article id={`meeting-${session.id}`} key={session.id} className={`rounded-lg border border-emerald-200 bg-emerald-50 p-4 ${searchParams.meetingPrepared === session.title ? "ring-4 ring-emerald-200" : ""}`}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                      {session.channelLabel} - {session.scope === "WORKSPACE" ? "Workspace et parcours" : "Parcours"}
                    </p>
                    <h3 className="mt-1 font-bold text-emerald-950">{session.title}</h3>
                  </div>
                  <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-800 ring-1 ring-emerald-200">
                    {session.statusLabel}
                  </span>
                </div>
                {session.purpose ? <p className="mt-3 text-sm text-emerald-950">Objectif : {session.purpose}</p> : null}
                <p className="mt-2 text-sm font-semibold text-emerald-950">Cette carte ouvre la réunion : {session.title}.</p>
                {governedMeetingUserNote(session.note) ? <p className="mt-2 whitespace-pre-wrap text-sm text-emerald-950">Note : {governedMeetingUserNote(session.note)}</p> : null}
                {session.attendance.length > 0 ? (
                  <div className="mt-3 rounded-lg border border-emerald-200 bg-white/80 p-3">
                    <p className="text-sm font-bold text-emerald-950">Participants</p>
                    <ul className="mt-2 space-y-1 text-sm text-emerald-950">
                      {session.attendance.map((participant) => (
                        <li key={participant.participantKey}>
                          {participant.displayName} — {participant.roleLabel} · {participant.accessKind}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-emerald-800">Présence historisée sans enregistrement ni transcription.</p>
                  </div>
                ) : null}
                <div className="mt-3 rounded-lg border border-emerald-200 bg-white/80 p-3">
                  <p className="text-sm font-bold text-emerald-950">Participants autorisés à cette réunion</p>
                  <p className="mt-1 text-xs text-emerald-800">Les invités gardent leur lien personnel. Goodissima ne transmet rien automatiquement.</p>
                  {session.status === "COMPLETED" || session.status === "CANCELLED" || Boolean(session.expiresAt && session.expiresAt <= new Date()) ? <p className="mt-1 text-xs font-bold text-slate-600">Périmètre verrouillé</p> : null}
                  {meetingParticipants.every((item) => item.communicationSessionId !== session.id || item.status !== "AUTHORIZED") ? <p className="mt-2 text-sm font-semibold text-slate-700">Aucun invité autorisé pour cette réunion.</p> : null}
                  {(() => { const metadata = asRecord(session.metadata); return !Array.isArray(metadata.selectedParticipantInvitationIds) ? <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Cette réunion a été préparée avant les autorisations par réunion. Ajoutez les invités autorisés ci-dessous.</p> : null; })()}
                  {governedInvitations.length === 0 ? <p className="mt-2 text-sm text-slate-600">Aucun invité gouverné.</p> : (
                    <div className="mt-2 space-y-2">
                      {governedInvitations.map((invitation) => {
                        const assignment = meetingParticipants.find((item) => item.communicationSessionId === session.id && item.governedJourneyInvitationId === invitation.id);
                        const invitationMetadata = asRecord(invitation.metadata);
                        const selectedPreviously = governedMeetingSelectedPreparedIds(session.metadata, session.note).some((preparedId) => participantInvitations.some((prepared) => prepared.invitationId === preparedId && prepared.participantName.toLocaleLowerCase("fr") === invitation.displayName.toLocaleLowerCase("fr") && (!text(invitationMetadata.participantRole) || prepared.participantRole.toLocaleLowerCase("fr") === text(invitationMetadata.participantRole)?.toLocaleLowerCase("fr"))));
                        const expired = invitation.accessTokenExpiresAt <= new Date();
                        const unavailable = invitation.status !== "ACTIVE" || Boolean(invitation.revokedAt) || expired;
                        const authorized = assignment?.status === "AUTHORIZED" && !unavailable;
                        const status = invitation.revokedAt || invitation.status === "REVOKED" ? "Accès révoqué" : expired || invitation.status === "EXPIRED" ? "Accès expiré" : authorized ? "Autorisé" : selectedPreviously ? "Sélectionné précédemment · à confirmer" : "Non autorisé";
                        return <div key={invitation.id} className="flex flex-col gap-2 rounded-lg border bg-white p-2 sm:flex-row sm:items-center sm:justify-between">
                          <div><p className="font-semibold text-slate-900">{invitation.displayName}</p><p className="text-xs text-slate-600">{governedInvitationRoleLabel(invitation.role)} · invité gouverné · {status}</p></div>
                          {!unavailable && session.status !== "COMPLETED" && session.status !== "CANCELLED" && !(session.expiresAt && session.expiresAt <= new Date()) ? <form action={authorized ? removeGuestFromGovernedMeetingAction : authorizeGuestForGovernedMeetingAction}>
                            <input type="hidden" name="formTemplateId" value={formTemplate.id} /><input type="hidden" name="communicationSessionId" value={session.id} /><input type="hidden" name="invitationId" value={invitation.id} />
                            <button className="rounded-lg border px-3 py-1.5 text-xs font-bold text-slate-700" type="submit">{authorized ? "Retirer de cette réunion" : "Autoriser à cette réunion"}</button>
                          </form> : null}
                        </div>;
                      })}
                    </div>
                  )}
                </div>
                {session.status === "PREPARED_NOT_STARTED" ? <div className="mt-3 grid gap-3 rounded-lg border border-slate-200 bg-white/80 p-3">
                  <form action={updateGovernedMeetingScheduleAction} className="flex flex-wrap items-end gap-2"><input type="hidden" name="formTemplateId" value={formTemplate.id} /><input type="hidden" name="communicationSessionId" value={session.id} /><label className="text-xs font-semibold text-slate-600">{session.scheduledAt ? "Reporter / modifier la date" : "Définir une date prévue"}<input required name="scheduledAt" type="datetime-local" className="mt-1 block rounded-lg border px-3 py-2 text-sm font-normal" /></label><button type="submit" className="rounded-lg border px-3 py-2 text-xs font-bold text-slate-700">Enregistrer la date</button><p className="w-full text-xs text-slate-500">Goodissima met à jour la date dans le parcours. Aucun participant n’est notifié automatiquement.</p></form>
                  <form action={cancelGovernedMeetingAction}><input type="hidden" name="formTemplateId" value={formTemplate.id} /><input type="hidden" name="communicationSessionId" value={session.id} /><ConfirmMeetingCancellationButton /></form>
                </div> : session.status === "CANCELLED" ? <p className="mt-3 rounded-lg bg-slate-100 p-3 text-sm font-semibold text-slate-700">Réunion annulée. Périmètre conservé pour historique.</p> : null}
                <div className="mt-3 rounded-lg bg-white/80 p-3 text-xs font-semibold text-emerald-900">
                  <p>Provider : {session.providerLabel}</p>
                  <p className="mt-1">Creee le : {formatDate(session.createdAt)}</p>
                  <p className="mt-1">Date prevue : {session.scheduledAt ? formatDate(session.scheduledAt) : "Non definie"}</p>
                  <p className="mt-1">Expiration : {session.expiresAt ? formatDate(session.expiresAt) : "Non definie"}</p>
                  <p className="mt-1">Terminee le : {session.status === "COMPLETED" ? formatDate(session.updatedAt) : "Non terminee"}</p>
                  <p className="mt-1">Email automatique : non</p>
                  <p className="mt-1">Notification : non</p>
                  <p className="mt-1">Token : non</p>
                  <p className="mt-1">Acces ouvert : {session.accessOpened ? "oui" : "non"}</p>
                  <p className="mt-1">Enregistrement : non</p>
                  <p className="mt-1">Transcription : non</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-lg border bg-slate-50 p-4 text-sm text-slate-600">
            Aucune communication gouvernee n'est preparee pour ce parcours.
          </p>
        )}
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
                <GovernanceReviewAIAssistant formTemplateId={formTemplate.id} reason={review.reason} question={review.question} humanNote={review.note} />
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

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-2xl font-bold text-slate-950">{value}</dd>
    </div>
  );
}
