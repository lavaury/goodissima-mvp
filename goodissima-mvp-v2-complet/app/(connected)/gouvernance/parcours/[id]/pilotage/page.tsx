import Link from "next/link";
import { PageNavigationContext } from "@/components/SpatialNavigationContext";
import { navigationWorkspaceSelect, objectBreadcrumb } from "@/lib/spatial-navigation";
import { notFound } from "next/navigation";
import { GovernedJourneyGuestAccessPanel } from "@/components/GovernedJourneyGuestAccessPanel";
import { GovernedJourneyActiveGuestAccessActions } from "@/components/GovernedJourneyActiveGuestAccessActions";
import { GovernedInvitationStatusRefresh } from "@/components/GovernedInvitationStatusRefresh";
import { GovernedJourneyPendingInvitationActions } from "@/components/GovernedJourneyPendingInvitationActions";
import { GovernedMeetingSubmitButton } from "@/components/GovernedMeetingSubmitButton";
import { ConfirmMeetingCancellationButton } from "@/components/ConfirmMeetingCancellationButton";
import { GovernanceReviewAIAssistant } from "@/components/GovernanceReviewAIAssistant";
import { ConfirmGovernanceReviewTransitionButton } from "@/components/ConfirmGovernanceReviewTransitionButton";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prepareGovernanceMultiActorCommunicationAction } from "@/lib/governance-communication-session-actions";
import { authorizeGuestForGovernedMeetingAction, removeGuestFromGovernedMeetingAction } from "@/lib/governed-meeting-participant-actions";
import { cancelGovernedMeetingAction, updateGovernedMeetingScheduleAction } from "@/lib/governed-meeting-lifecycle-actions";
import { reusePastGovernedMeetingAction } from "@/lib/governed-meeting-history-actions";
import { declareDocumentReceptionAction } from "@/lib/governance-document-receptions-actions";
import { prepareParticipantInvitationAction } from "@/lib/governance-participant-invitations-actions";
import { prepareGovernanceReviewAction, transitionGovernanceReviewAction } from "@/lib/governance-review-preparations-actions";
import {
  getGovernanceCommunicationOverview,
} from "@/lib/governance-communication-session-repository";
import { getGovernanceCockpitConsolidation } from "@/lib/governance-cockpit-consolidation-repository";
import { getGovernanceWorkspaceOptions } from "@/lib/governance-workspace-repository";
import { changeGovernedJourneyWorkspaceAction } from "@/lib/governance-workspace-actions";
import { prisma } from "@/lib/prisma";
import { getTemplateReadAccess } from "@/lib/relation-template-access";
import { classifyRelationTemplate } from "@/lib/business-object-classification";
import { opportunityOwnerHref } from "@/lib/opportunities/opportunity-projection";
import { HistoricalTemplateCompatibilityView } from "@/components/HistoricalTemplateCompatibilityView";
import { projectGovernedJourneyExperience } from "@/lib/governed-journey-experience";
import { equivalentJourneyText } from "@/lib/governed-journey-ux";
import { JOURNEY_HISTORY_INITIAL_COUNT, orderJourneyHistory } from "@/lib/governed-journey-history";
import { canScheduleGovernedMeeting, meetingIsClosed, meetingListCategory, selectPrimaryMeetings } from "@/lib/governed-journey-meetings";
import { GovernedJourneyMemorySection } from "@/components/GovernedJourneyMemorySection";
import { GovernedJourneyAddParticipantPanel } from "@/components/GovernedJourneyAddParticipantPanel";
import { readJourneyGovernedMemory } from "@/lib/governed-memory/runtime";
import { meetingRsvpLabel } from "@/lib/governed-meeting-rsvp";
import { hasCurrentJourneyAccess, projectJourneyParticipationState } from "@/lib/governed-journey-consent";
import { getGovernedInvitationRoleLabel } from "@/lib/governed-invitation-role-label";
import { projectCanonicalJourneyPeople, projectCompactJourneyPeople } from "@/lib/governed-journey-people";
import { projectAssignableJourneyParticipants, projectExpectedRoleAssignment } from "@/lib/governed-journey-role-assignments";
import { revokeExpectedRoleAssignmentAction } from "@/lib/governed-journey-role-assignment-actions";
import { projectJourneyMemberCandidates } from "@/lib/governed-meeting-participant-selection";
import { GovernedMeetingParticipantSelection } from "@/components/GovernedMeetingParticipantSelection";
import { GovernedJourneyCurrentStateView } from "@/components/GovernedJourneyCurrentState";
import { projectGovernedJourneyCurrentState } from "@/lib/governed-journey-current-state";
import { readGovernedJourneyCurrentStateMemoryCounts } from "@/lib/governed-journey-current-state-memory";
import { getMatchingContextForJourneyParticipantPicker } from "@/lib/journey-matching-context";

export const dynamic = "force-dynamic";

type Actor = {
  id: string;
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
  status: "PREPARED_NOT_STARTED" | "IN_HUMAN_REVIEW" | "COMPLETED";
  reason: string;
  question: string;
  note: string | null;
  preparedAt: string;
  startedAt: string | null;
  completedAt: string | null;
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
    .map((item, index) => {
      const row = asRecord(item);
      const name = text(row.name);
      const role = text(row.role) ?? "Rôle à pourvoir";
      const id = text(row.roleId) ?? `expected-role-${index + 1}`;
      return name ? { id, name, role } : null;
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

function defaultInvitationMessageDraft(input: { journeyTitle: string; journeyObjective: string | null; participantRole: string; inviterName: string }) {
  return [
    "Bonjour,",
    "",
    `${input.inviterName} vous invite à participer au parcours « ${input.journeyTitle} ».`,
    ...(input.journeyObjective ? [`Objectif : ${input.journeyObjective}`] : []),
    `Rôle proposé : ${input.participantRole}.`,
    "Cette invitation concerne le parcours, pas automatiquement toutes ses réunions.",
    "Participer permet de consulter les éléments rendus accessibles et de contribuer selon le rôle attribué.",
    "Cette invitation n'a pas ete envoyee automatiquement par Goodissima.",
    "L’ouverture du lien ne vaut pas acceptation : la personne invitée pourra accepter ou refuser explicitement, sans compte obligatoire. Le lien personnel ne vérifie pas son identité.",
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

  const seen = new Set<string>();

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
        status: row.status === "IN_HUMAN_REVIEW" || row.status === "COMPLETED" ? row.status : "PREPARED_NOT_STARTED",
        reason,
        question,
        note: text(row.note),
        preparedAt,
        startedAt: text(row.startedAt),
        completedAt: text(row.completedAt),
        updatedAt: text(row.updatedAt) ?? preparedAt,
        preparedById,
        meetingCreated: false as const,
        notificationSent: false as const,
        aiSummaryGenerated: false as const,
        automaticDecision: false as const,
        workflowStarted: false as const,
      };
    })
    .filter((item): item is GovernanceReviewPreparation => {
      if (!item || seen.has(item.reviewPreparationId)) return false;
      seen.add(item.reviewPreparationId);
      return true;
    });
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "Date non disponible";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "Date non disponible";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function meetingRsvpEventLabel(type: string) {
  return ({ INVITED: "Invitation envoyée", ACCEPTED: "Participation acceptée", DECLINED: "Participation déclinée", RESET_TO_PENDING: "Réponse réinitialisée", MEETING_CANCELLED: "Réunion annulée" } as Record<string, string>)[type] ?? "Événement RSVP";
}

export default async function GovernedJourneyPilotagePage({ params, searchParams }: { params: { id: string }; searchParams: { meetingPrepared?: string; similarMeetingId?: string; technical?: string; meetingAction?: string; meetingId?: string } }) {
  const owner = await getCurrentPrismaUser();
  if (!await getTemplateReadAccess(owner, params.id)) notFound();
  const organizationName = owner.name && owner.name !== owner.email ? owner.name : "Organisation Goodissima";

  const formTemplate = await prisma.formTemplate.findUnique({
    where: { id: params.id },
    include: {
      fields: { orderBy: [{ step: "asc" }, { position: "asc" }] },
      relationTemplate: {
        include: {
          workspace: { select: navigationWorkspaceSelect },
          relationCases: { where: { ownerId: owner.id }, select: { id: true, candidateName: true }, orderBy: { createdAt: "desc" } },
          links: { where: { ownerId: owner.id }, select: { id: true, title: true, status: true, rules: true, templateId: true }, orderBy: { createdAt: "desc" } },
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
  if (!formTemplate.relationTemplate) notFound();
  const creationPlan = asRecord(metadata.creationPlan);
  const title = text(creationPlan.title) ?? formTemplate.name;
  const classification = classifyRelationTemplate(snapshot);
  if (classification !== "JOURNEY") return <HistoricalTemplateCompatibilityView
    title={title}
    description={formTemplate.description ?? formTemplate.relationTemplate.description}
    ambiguous={classification === "LEGACY_AMBIGUOUS"}
    links={formTemplate.relationTemplate.links.map(link => ({ title: link.title, status: link.status, href: opportunityOwnerHref(link) }))}
    cases={formTemplate.relationTemplate.relationCases.map(item => ({ candidateName: item.candidateName, href: `/cases/${encodeURIComponent(item.id)}` }))}
  />;
  const workspaceOptions = await getGovernanceWorkspaceOptions(owner.id);
  const validation = asRecord(metadata.humanValidation);

  const objective = text(creationPlan.objective) ?? formTemplate.description ?? "Objectif non renseigné.";
  const initialNeed = text(creationPlan.initialNeed) ?? formTemplate.description ?? "Besoin initial non renseigné.";
  const showInitialNeed = !equivalentJourneyText(initialNeed, title) && !equivalentJourneyText(initialNeed, objective);
  const workspaceDisplay =
    text(metadata.workspaceName) ??
    text(metadata.workspaceSlug) ??
    text(creationPlan.workspaceId) ??
    text(metadata.workspaceId) ??
    "Workspace non rattaché en V1";
  const attachedWorkspaceId = formTemplate.relationTemplate?.workspaceId ?? null;
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
  const communicationCapabilities = [{ channelType: "VIDEO_IP" }] as const;
  const consolidation = searchParams.technical === "1"
    ? await getGovernanceCockpitConsolidation({ ownerId: owner.id, formTemplateId: formTemplate.id })
    : null;
  const governedInvitations = formTemplate.relationTemplate?.id
      ? await prisma.governedJourneyInvitation.findMany({
        where: { ownerId: owner.id, relationTemplateId: formTemplate.relationTemplate.id },
        include: { consent: true, inviteeUser: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const roleJourney = await prisma.governedJourney.findFirst({ where: { relationTemplateId: formTemplate.relationTemplate.id, authorityUserId: owner.id }, select: { id: true, expectedRoleAssignments: { where: { revokedAt: null }, orderBy: { assignedAt: "desc" }, include: { assigneeUser: { select: { id: true, name: true, email: true } }, assigneeInvitation: { include: { consent: true } } } } } });
  const matchingContexts = roleJourney ? await getMatchingContextForJourneyParticipantPicker({ currentUserId: owner.id, governedJourneyId: roleJourney.id }) : [];
  const meetingParticipants = communicationOverview.sessions.length > 0
    ? await prisma.governedMeetingParticipant.findMany({ where: { communicationSessionId: { in: communicationOverview.sessions.map((session) => session.id) } }, include: {
        governedJourneyInvitation: { include: { consent: true, inviteeUser: { select: { name: true, email: true } } } },
        rsvp: { include: { decidedByUser: { select: { name: true, email: true } }, decidedByInvitation: { select: { displayName: true } } } },
        rsvpEvents: { orderBy: [{ occurredAt: "asc" }, { id: "asc" }], include: { actorUser: { select: { name: true, email: true } }, actorInvitation: { select: { displayName: true } } } },
      } })
    : [];
  const activeJourneyInvitations = governedInvitations.filter((invitation) => invitation.accessTokenExpiresAt > new Date() && (projectJourneyParticipationState(invitation) === "ACCEPTED" || (projectJourneyParticipationState(invitation) === "LEGACY_UNKNOWN" && invitation.status === "ACTIVE")));
  const pendingJourneyInvitations = governedInvitations.filter((invitation) => invitation.accessTokenExpiresAt > new Date() && projectJourneyParticipationState(invitation) === "PENDING");
  const participantUserIds = [...new Set([owner.id, ...activeJourneyInvitations.flatMap(invitation => invitation.inviteeUserId ? [invitation.inviteeUserId] : [])])];
  const publicProfiles = await prisma.directoryProfile.findMany({ where: { status: "PUBLISHED", actorType: "PERSON", deletedAt: null, subjectIdentity: { user: { id: { in: participantUserIds } } } }, select: { publicName: true, subjectIdentity: { select: { user: { select: { id: true } } } } } });
  const publicNamesByUserId = new Map(publicProfiles.flatMap(profile => profile.subjectIdentity.user ? [[profile.subjectIdentity.user.id, profile.publicName] as const] : []));
  const canonicalPeople = projectCanonicalJourneyPeople({ organizer: { id: owner.id, name: owner.name || owner.email }, participants: activeJourneyInvitations, publicNamesByUserId });
  const peopleProjection = projectCompactJourneyPeople(canonicalPeople, pendingJourneyInvitations);
  const participantSelections = communicationOverview.sessions.length > 0 ? await prisma.governedParticipantSelection.findMany({
    where: { ownerId: owner.id, targetType: "MEETING", source: "JOURNEY_MEMBERS", communicationSessionId: { in: communicationOverview.sessions.map((session) => session.id) } },
    include: { items: { orderBy: [{ snapshotDisplayName: "asc" }, { id: "asc" }] } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  }) : [];
  const latestSelectionBySession = new Map<string, (typeof participantSelections)[number]>();
  for (const selection of participantSelections) {
    if (selection.communicationSessionId && !latestSelectionBySession.has(selection.communicationSessionId)) {
      latestSelectionBySession.set(selection.communicationSessionId, selection);
    }
  }
  const candidateCountBySession = new Map(communicationOverview.sessions.map((session) => [session.id, projectJourneyMemberCandidates({
    organizer: { id: owner.id, displayName: publicNamesByUserId.get(owner.id) ?? owner.name ?? owner.email },
    invitations: governedInvitations,
    meetingParticipants: meetingParticipants.filter((participant) => participant.communicationSessionId === session.id),
    publicNamesByUserId,
  }).length]));
  const assignableJourneyParticipants = projectAssignableJourneyParticipants(governedInvitations, { ownerId: owner.id, currentUserId: owner.id }).map(participant => { const invitation = governedInvitations.find(item => item.id === participant.invitationId); return { ...participant, displayName: invitation?.inviteeUserId ? publicNamesByUserId.get(invitation.inviteeUserId) ?? invitation.inviteeUser?.name ?? invitation.inviteeUser?.email ?? participant.displayName : participant.displayName }; });
  const roleProjections = participants.map(participant => { const assignment = roleJourney?.expectedRoleAssignments.find(item => item.expectedRoleId === participant.id); return { participant, assignment, state: projectExpectedRoleAssignment(assignment) }; });
  const unfilledRoles = roleProjections.filter(item => item.state === "UNASSIGNED" && !participantMatchesOrganizer(item.participant.name, owner)).map(item => item.participant);
  const expectedParticipantNames = new Set(participants.map((participant) => participant.name.toLocaleLowerCase("fr")));
  const additionalActiveParticipants = activeJourneyInvitations.filter((invitation) => !expectedParticipantNames.has(invitation.displayName.toLocaleLowerCase("fr")));
  const pendingReviews = governanceReviewPreparations.filter((review) => review.status !== "COMPLETED").length;
  const primaryMeetings = selectPrimaryMeetings(communicationOverview.sessions);
  const meetingToComplete = primaryMeetings.find((meeting) => !meetingIsClosed(meeting));
  const meetingToSchedule = primaryMeetings.find(canScheduleGovernedMeeting);
  const meetingParticipantCount = meetingToComplete ? meetingParticipants.filter((item) => item.communicationSessionId === meetingToComplete.id && item.status === "AUTHORIZED").length : 0;
  const meetingActions = meetingToComplete && meetingParticipantCount === 0
    ? [{ label: `Invitez les participants à la réunion « ${meetingToComplete.title} »`, detail: "Aucun autre participant n’a encore accès à cette réunion.", href: `#meeting-${meetingToComplete.id}` }]
    : meetingToSchedule
      ? [{ label: `Fixez la date de la réunion « ${meetingToSchedule.title} »`, detail: "Cette réunion préparée n’a pas encore de date.", href: `?meetingAction=schedule&meetingId=${encodeURIComponent(meetingToSchedule.id)}#meeting-${meetingToSchedule.id}` }]
      : [];
  const rolesAction = unfilledRoles.length === 1
    ? [{ label: `Choisir ${unfilledRoles[0].name}`, detail: unfilledRoles[0].role, href: "#roles-to-fill" }]
    : unfilledRoles.length > 1
      ? [{ label: `${unfilledRoles.length} rôles restent à pourvoir`, detail: unfilledRoles.map((participant) => participant.role).join(" · "), href: "#roles-to-fill" }]
      : [];
  const experience = projectGovernedJourneyExperience({
    humanValidated,
    totalParticipants: 0,
    preparedInvitations: 0,
    totalDocuments: summary.totalDocuments,
    receivedDocuments: summary.declaredReceptionsCount,
    pendingReviews,
    interventions: [...meetingActions, ...rolesAction],
  });
  const governedMemoryJourney = await prisma.governedJourney.findFirst({
    where: { formTemplateId: formTemplate.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, relationCaseId: true, relationCaseContexts: { select: { relationCaseId: true }, take: 1 } },
  });
  const governedMemory = governedMemoryJourney ? await readJourneyGovernedMemory(governedMemoryJourney.id) : null;
  const currentStateNow = new Date();
  const currentStateMemory = governedMemoryJourney ? await readGovernedJourneyCurrentStateMemoryCounts(governedMemoryJourney.id, currentStateNow) : null;
  const currentState = projectGovernedJourneyCurrentState({
    memory: currentStateMemory,
    participantCount: canonicalPeople.length,
    activeRoleCount: roleProjections.filter((item) => item.state === "ASSIGNED").length,
    vacantRoleCount: unfilledRoles.length,
    expectedDocumentCount: summary.totalDocuments,
    receivedDocumentCount: summary.declaredReceptionsCount,
    pendingReviewCount: pendingReviews,
    unscheduledMeetingCount: communicationOverview.sessions.filter(canScheduleGovernedMeeting).length,
    meetingWithoutParticipantCount: communicationOverview.sessions.filter((session) => !meetingIsClosed(session, currentStateNow) && meetingParticipants.every((participant) => participant.communicationSessionId !== session.id || participant.status !== "AUTHORIZED")).length,
    meetings: communicationOverview.sessions,
    now: currentStateNow,
  });
  const memoryRights = governedMemory ? [
    ...(governedMemory.capabilities.canPropose ? ["Peut proposer des faits"] : []),
    ...(governedMemory.capabilities.canRecordDecision ? ["Peut préparer des décisions"] : []),
    ...(governedMemory.capabilities.canRegisterSource ? ["Peut ajouter des sources"] : []),
    ...(governedMemory.capabilities.canEstablishFact ? ["Peut confirmer des faits"] : []),
    ...(governedMemory.capabilities.canValidateDecision ? ["Peut confirmer des décisions"] : []),
    ...(governedMemory.capabilities.canDispute ? ["Peut contester des faits"] : []),
  ] : [];
  const currentActions = experience.actions;
  const journeyHistory = orderJourneyHistory([
    ...(version?.createdAt ? [{ key: `journey-${version.id}`, occurredAt: version.createdAt.toISOString(), text: "Le parcours a été créé.", source: "journey" as const }] : []),
    ...participantInvitations.map((item) => ({ key: `invitation-${item.invitationId}`, occurredAt: item.preparedAt, text: `Une invitation au parcours a été préparée pour ${item.participantName}.`, source: "invitation" as const })),
    ...documentReceptions.map((item) => ({ key: `document-${item.receptionId}`, occurredAt: item.receivedAt, text: "La réception d’un document a été déclarée.", detail: item.documentName, source: "document" as const })),
    ...governanceReviewPreparations.map((item) => ({ key: `review-${item.reviewPreparationId}`, occurredAt: item.updatedAt, text: "Une décision de travail a été mise à jour.", detail: item.question, source: "review" as const })),
    ...communicationOverview.sessions.map((session) => ({ key: `meeting-${session.id}`, occurredAt: session.createdAt.toISOString(), text: "Une réunion a été préparée.", detail: session.title, source: "meeting" as const })),
    ...(governedMemory?.history ?? []).map((item) => ({ key: `memory-${item.handle}`, occurredAt: item.occurredAt, text: `${item.actorLabel} ${item.action}`, detail: item.objectLabel, source: "memory" as const })),
  ]);
  const initialHistory = journeyHistory.slice(0, JOURNEY_HISTORY_INITIAL_COUNT);
  const additionalHistory = journeyHistory.slice(JOURNEY_HISTORY_INITIAL_COUNT);
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <GovernedInvitationStatusRefresh pendingCount={pendingJourneyInvitations.length} />
      <PageNavigationContext pathname={`/gouvernance/parcours/${encodeURIComponent(formTemplate.id)}/pilotage`} items={objectBreadcrumb({ name: title, fallback: "Parcours", objectId: formTemplate.id, ownerId: owner.id, workspace: formTemplate.relationTemplate.workspace })} />

      {searchParams.meetingPrepared ? <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-emerald-950"><p className="font-bold">Réunion préparée : {searchParams.meetingPrepared}</p><p className="mt-1 text-sm">Vous pouvez maintenant l’ouvrir depuis sa carte.</p></div> : null}
      {searchParams.similarMeetingId ? <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950"><p className="font-bold">Une réunion similaire existe déjà.</p><a href={`#meeting-${searchParams.similarMeetingId}`} className="mt-2 inline-block text-sm font-bold underline">Voir la réunion existante</a></div> : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <details className="relative ml-auto">
          <summary className="min-h-11 cursor-pointer list-none rounded-lg border px-4 py-2 text-xl font-bold" aria-label="Actions avancées">•••</summary>
          <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border bg-white p-2 shadow-xl">
            <Link href="/annuaire" className="block min-h-11 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-slate-50">Gérer les accès</Link>
            <Link href="/gouvernance/nouveau" className="block min-h-11 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-slate-50">Créer un autre parcours</Link>
            <a href="#organize" className="block min-h-11 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-slate-50">Organiser</a>
            <Link href={`/gouvernance/parcours/${encodeURIComponent(formTemplate.id)}/pilotage?technical=1#technical-workspace`} className="block min-h-11 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-slate-50">Informations techniques</Link>
          </div>
        </details>
      </div>

      <section data-boussole-id="governed-journey-overview" className="mt-4 rounded-lg border bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-[#247f88]">Parcours gouverné</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">{title}</h1>
        <p className="mt-3 max-w-4xl text-sm leading-relaxed text-slate-700">{objective}</p>

      </section>

      <section aria-labelledby="journey-frame-title" className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50/60 p-4 shadow-sm sm:p-5">
        <h2 id="journey-frame-title" className="text-lg font-bold text-slate-950">Cadre du parcours</h2>
        <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-3">
          <div className="min-w-0 rounded-lg bg-white p-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Objectif</p><p className="mt-1 break-words text-sm text-slate-800">{equivalentJourneyText(objective, title) ? "Le titre du parcours constitue l’objectif actuellement renseigné." : objective}</p></div>
          <div className="min-w-0 rounded-lg bg-white p-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Personnes et rôles</p><p className="mt-1 text-sm text-slate-800">{canonicalPeople.length} personne{canonicalPeople.length > 1 ? "s" : ""} active{canonicalPeople.length > 1 ? "s" : ""} · {unfilledRoles.length} rôle{unfilledRoles.length > 1 ? "s" : ""} à pourvoir</p></div>
          <div className="min-w-0 rounded-lg bg-white p-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Votre rôle</p><p className="mt-1 text-sm font-semibold text-slate-900">Vous êtes organisateur.</p></div>
        </div>
        <details className="mt-3 rounded-lg border bg-white">
          <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-bold text-cyan-900">Voir les rôles et les droits</summary>
          <div className="grid gap-3 border-t p-4 text-sm sm:grid-cols-2">
            <div><p className="font-bold text-slate-900">Organisateur</p><ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700"><li>Peut organiser ce parcours</li><li>Peut préparer les invitations</li><li>Peut préparer et ouvrir les réunions</li></ul></div>
            {memoryRights.length > 0 ? <div><p className="font-bold text-slate-900">Dans la mémoire du parcours</p><ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">{memoryRights.map((right) => <li key={right}>{right}</li>)}</ul></div> : null}
          </div>
          <a href="#people" className="mx-4 mb-4 inline-flex min-h-11 items-center text-sm font-bold text-cyan-900 underline underline-offset-4">Voir les participants</a>
        </details>
      </section>

      <GovernedJourneyCurrentStateView state={currentState} journeyId={governedMemoryJourney?.id} />

      <section data-boussole-id="governed-journey-human-interventions" data-boussole-state={currentActions.length > 0 ? "pending" : "empty"} className="mt-6 rounded-2xl border-2 border-cyan-700 bg-cyan-50 p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-950">À faire maintenant</h2>
        {experience.totalActionCount > currentActions.length ? <p className="mt-2 text-sm font-semibold text-cyan-950">{experience.totalActionCount} actions demandent votre attention. Les {currentActions.length} premières sont affichées.</p> : null}
        {currentActions.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{currentActions.map((action, index) => <a key={`${action.href}-${index}`} data-boussole-id={index === 0 ? "governed-journey-human-intervention" : undefined} href={action.href} className="min-h-11 rounded-xl border bg-white p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-800"><span className="font-bold text-slate-950">{action.label}</span><span className="mt-1 block text-sm text-slate-600">{action.detail}</span></a>)}</div> : <p className="mt-3 text-sm text-slate-700">Vous pouvez poursuivre le travail ou consulter l’historique quand vous en avez besoin.</p>}
      </section>

      <details id="organize" className="mt-6 rounded-lg border bg-white shadow-sm">
        <summary data-boussole-id="governed-journey-workspace" className="min-h-11 cursor-pointer px-6 py-4 font-bold text-slate-800">Organiser le parcours</summary>
        <div className="border-t p-6"><p className="text-sm text-slate-600">Espace actuel : <strong>{workspaceDisplay}</strong></p>
        {workspaceOptions.length > 0 ? <form action={changeGovernedJourneyWorkspaceAction} className="mt-4 space-y-3">
          <input type="hidden" name="formTemplateId" value={formTemplate.id} />
          <label className="block text-sm font-semibold text-slate-700">Déplacer vers un autre espace
            <select required name="workspaceId" defaultValue={attachedWorkspaceId ?? ""} className="mt-1 block w-full max-w-xl rounded-lg border px-3 py-2 font-normal">
              <option value="" disabled>Choisir un espace</option>
              {workspaceOptions.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name} - {workspace.categoryLabel} - {workspace.kindLabel}</option>)}
            </select>
          </label>
          <label className="flex max-w-2xl items-start gap-2 text-sm text-slate-600"><input required type="checkbox" name="humanConfirmed" value="yes" className="mt-1" /><span>Je confirme explicitement le changement de Workspace. Les invitations, acces et dossiers existants ne sont pas modifies.</span></label>
          <button type="submit" className="min-h-11 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">Déplacer le parcours</button>
        </form> : <p className="mt-3 text-sm text-slate-500">Aucun autre espace actif disponible.</p>}</div>
      </details>

      <details className="mt-6 rounded-lg border bg-white shadow-sm"><summary className="min-h-11 cursor-pointer px-6 py-4 font-bold text-slate-800">Voir les indicateurs détaillés</summary><section className="border-t p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Indicateurs du parcours</h2>
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
        </div>

        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
          Goodissima ne vérifie pas automatiquement les documents, n’envoie pas les invitations et ne lance pas les revues.
        </p>
      </section></details>

      {showInitialNeed ? <section data-boussole-id="governed-journey-initial-need" className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-950">Contexte</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{initialNeed}</p>
      </section> : null}

      {searchParams.technical === "1" && consolidation?.workspace ? (
        <details id="technical-workspace" className="mt-6 rounded-lg border border-dashed bg-slate-50 shadow-sm"><summary className="min-h-11 cursor-pointer px-6 py-4 font-bold text-slate-800">Organisation technique du Workspace</summary><section data-boussole-id="governed-journey-consolidation" className="border-t p-6">
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
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600">Echanges rattaches</h3>
              <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-600">
                <span className="rounded-full bg-white px-2.5 py-1">Preparees : {consolidation.preparedCommunicationCount}</span>
                <span className="rounded-full bg-white px-2.5 py-1">Actives : {consolidation.activeCommunicationCount}</span>
                <span className="rounded-full bg-white px-2.5 py-1">Terminees : {consolidation.completedCommunicationCount}</span>
                <span className="rounded-full bg-white px-2.5 py-1">Expirees : {consolidation.expiredCommunicationCount}</span>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <p className="text-sm font-bold text-slate-950">Echanges prepares</p>
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
                            <Link data-boussole-id="governed-journey-media-room" href={`/gouvernance/parcours/${formTemplate.id}/reunions/${session.id}`} className="inline-flex min-h-11 items-center rounded-xl bg-[#247f88] px-4 py-2 font-semibold text-white">Ouvrir la salle dédiée</Link>
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

          <div data-boussole-id="governed-journey-human-interventions-detail" data-boussole-state={consolidation.humanInterventions.length > 0 ? "pending" : "empty"} className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
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
                  <article key={signal.id} data-boussole-id="governed-journey-human-intervention-detail" className="rounded-lg bg-white p-3 text-sm">
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
        </section></details>
      ) : null}

      <section id="people" data-boussole-id="governed-journey-organizer" className="mt-6 rounded-lg border border-[#b9dfe2] bg-[#f5ffff] p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-950">Les personnes</h2>
        <div className="mt-4">
        <section data-boussole-id="governed-journey-participants" className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><h3 className="text-lg font-bold text-slate-950">Participants du parcours</h3><p className="text-sm font-semibold text-slate-600">{canonicalPeople.length} actif{canonicalPeople.length > 1 ? "s" : ""}</p></div>
          <GovernedJourneyAddParticipantPanel formTemplateId={formTemplate.id} governedJourneyId={roleJourney?.id} matchingContexts={matchingContexts} journeyTitle={title} journeyObjective={equivalentJourneyText(objective, title) ? null : objective} />
          <ul className="mt-4 divide-y rounded-lg border bg-slate-50">{peopleProjection.visibleActive.map((person, index) => <li key={person.key} data-boussole-id={index === 0 ? "governed-journey-participant" : undefined} className="min-w-0 p-3"><p className="break-words font-semibold text-slate-950">{person.displayName}</p><p className="text-sm text-slate-600">{person.qualities.map(quality => quality === "ORGANIZER" ? "Organisateur" : person.identityVerified ? "Participant" : "Participant externe").join(" · ")}</p>{!person.identityVerified ? <p className="mt-1 text-xs text-slate-500">Identité déclarée, non vérifiée</p> : null}</li>)}</ul>
          {canonicalPeople.some(person => !person.identityVerified && person.invitationId) ? <section className="mt-4 rounded-lg border bg-slate-50 p-3" aria-labelledby="active-guest-access-title"><h4 id="active-guest-access-title" className="font-bold text-slate-950">Accès des participants externes</h4><ul className="mt-2 divide-y">{canonicalPeople.filter(person => !person.identityVerified && person.invitationId).map(person => <li key={person.key} className="py-3"><p className="font-semibold text-slate-950">{person.displayName}</p><GovernedJourneyActiveGuestAccessActions invitationId={person.invitationId!} displayName={person.displayName} /></li>)}</ul></section> : null}
          <section className="mt-6 border-t pt-5" aria-labelledby="pending-journey-invitations-title"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><h3 id="pending-journey-invitations-title" className="font-bold text-slate-950">Invitations en attente</h3><p className="text-sm font-semibold text-slate-600">{peopleProjection.totalPending}</p></div>{pendingJourneyInvitations.length === 0 ? <p className="mt-3 text-sm text-slate-600">Aucune invitation n’attend actuellement de réponse.</p> : <ul className="mt-3 divide-y rounded-lg border bg-amber-50/50">{peopleProjection.visiblePending.map((invitation) => { const metadata = asRecord(invitation.metadata); const rawContext = text(metadata.participantRole) || text(metadata.expectedRoleContext); const participationContext = rawContext && rawContext !== "Participant attendu" && rawContext !== "Participant invité" ? rawContext : getGovernedInvitationRoleLabel(invitation.role, invitation.metadata); return <li key={invitation.id} className="p-4"><p className="font-semibold text-slate-950">{invitation.displayName}</p><p className="mt-1 text-sm text-slate-700">Invitation en attente</p>{participationContext ? <p className="mt-1 text-sm text-slate-600">Contexte de participation : {participationContext}</p> : <p className="mt-1 text-sm text-slate-600">Participation prévue</p>}<p className="mt-2 text-xs text-slate-500">Le lien personnel n’est affiché qu’à sa création et ne peut pas être reconstruit. Cette invitation ne vérifie pas l’identité de la personne.</p><GovernedJourneyPendingInvitationActions invitationId={invitation.id} /></li>; })}</ul>}</section>
          {peopleProjection.hasOverflow ? <details className="mt-4 rounded-lg border bg-white"><summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-bold text-[#176b73]">Voir toutes les personnes ({peopleProjection.totalPeople})</summary><div className="space-y-5 border-t p-4">{peopleProjection.remainingActive.length ? <section aria-labelledby="remaining-active-people-title"><h4 id="remaining-active-people-title" className="font-bold text-slate-950">Autres participants du parcours</h4><ul className="mt-2 divide-y rounded-lg border bg-slate-50">{peopleProjection.remainingActive.map(person => <li key={person.key} className="min-w-0 p-3"><p className="break-words font-semibold text-slate-950">{person.displayName}</p><p className="text-sm text-slate-600">{person.qualities.map(quality => quality === "ORGANIZER" ? "Organisateur" : person.identityVerified ? "Participant" : "Participant externe").join(" · ")}</p>{!person.identityVerified ? <p className="mt-1 text-xs text-slate-500">Identité déclarée, non vérifiée</p> : null}</li>)}</ul></section> : null}{peopleProjection.remainingPending.length ? <section aria-labelledby="remaining-pending-people-title"><h4 id="remaining-pending-people-title" className="font-bold text-slate-950">Autres invitations en attente</h4><ul className="mt-2 divide-y rounded-lg border bg-amber-50/50">{peopleProjection.remainingPending.map((invitation) => { const metadata = asRecord(invitation.metadata); const rawContext = text(metadata.participantRole) || text(metadata.expectedRoleContext); const participationContext = rawContext && rawContext !== "Participant attendu" && rawContext !== "Participant invité" ? rawContext : getGovernedInvitationRoleLabel(invitation.role, invitation.metadata); return <li key={invitation.id} className="p-4"><p className="font-semibold text-slate-950">{invitation.displayName}</p><p className="mt-1 text-sm text-slate-700">Invitation en attente</p>{participationContext ? <p className="mt-1 text-sm text-slate-600">Contexte de participation : {participationContext}</p> : <p className="mt-1 text-sm text-slate-600">Participation prévue</p>}<p className="mt-2 text-xs text-slate-500">Le lien personnel n’est affiché qu’à sa création et ne peut pas être reconstruit. Cette invitation ne vérifie pas l’identité de la personne.</p><GovernedJourneyPendingInvitationActions invitationId={invitation.id} /></li>; })}</ul></section> : null}</div></details> : null}

          <section id="roles-to-fill" className="mt-6 border-t pt-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><h3 className="font-bold text-slate-950">Rôles du parcours</h3><p className="text-sm font-semibold text-slate-600">{unfilledRoles.length} à pourvoir</p></div>
            {roleProjections.length === 0 ? <p className="mt-3 text-sm text-slate-600">Aucun rôle attendu n’est défini.</p> : <details className="mt-3 rounded-lg border bg-slate-50" open={roleProjections.length <= 5}><summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-bold text-slate-800">{unfilledRoles.length} rôle{unfilledRoles.length > 1 ? "s" : ""} à pourvoir</summary><ul className="divide-y border-t">{roleProjections.map(({ participant, assignment, state }) => { const assigneeName = assignment?.assigneeUser ? publicNamesByUserId.get(assignment.assigneeUser.id) ?? assignment.assigneeUser.name ?? assignment.assigneeUser.email : assignment?.assigneeInvitation?.displayName; const roleLabel = participant.role === "Participant attendu" && participant.name !== participant.role ? participant.name : participant.role || "Participation prévue"; return <li key={participant.id} className="min-w-0 p-3"><div className="min-w-0"><p className="break-words font-semibold text-slate-950">{roleLabel}</p><p className="text-sm text-slate-600">{state === "ASSIGNED" ? `${assigneeName} · Rôle pourvu` : state === "PENDING_INVITATION" ? `${assigneeName} · Invitation en attente` : "Aucune personne associée"}</p></div>{state === "UNASSIGNED" ? <GovernedJourneyAddParticipantPanel formTemplateId={formTemplate.id} governedJourneyId={roleJourney?.id} journeyParticipants={assignableJourneyParticipants} journeyTitle={title} journeyObjective={equivalentJourneyText(objective, title) ? null : objective} expectedRoleId={participant.id} initialParticipantRole={participant.role} initialParticipationContext={participant.name} initialGovernedRole={governedRoleFromParticipant(participant.role)} contextual /> : null}{state === "ASSIGNED" ? <form action={revokeExpectedRoleAssignmentAction} className="mt-2"><input type="hidden" name="formTemplateId" value={formTemplate.id} /><input type="hidden" name="assignmentId" value={assignment?.id} /><button className="min-h-11 text-sm font-bold text-red-800 underline">Retirer de ce rôle</button></form> : null}</li>; })}</ul></details>}
          </section>

          {searchParams.technical === "1" ? <details className="mt-6 rounded-lg border border-dashed bg-slate-50"><summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-bold text-slate-700">Outils historiques de préparation</summary><div className="border-t p-3">
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
                  defaultInvitationMessageDraft({ journeyTitle: title, journeyObjective: equivalentJourneyText(objective, title) ? null : objective, participantRole: participant.role, inviterName: owner.name || owner.email });
                const participantGovernedInvitations = governedInvitations
                  .filter((access) => {
                    const accessMetadata = asRecord(access.metadata);
                    const linkedName = text(accessMetadata.participantName) ?? access.displayName;
                    const linkedRole = text(accessMetadata.participantRole);
                    return linkedName.toLowerCase() === participant.name.toLowerCase() &&
                      (!linkedRole || linkedRole.toLowerCase() === participant.role.toLowerCase());
                  })
                  .map((access) => ({ id: access.id, displayName: access.displayName, role: access.role,
                    status: access.status, consentStatus: access.consent?.status ?? null, expiresAt: access.accessTokenExpiresAt.toISOString(), relationCaseId: access.relationCaseId }));

                return (
                <article key={`${participant.name}-${index}`} data-boussole-id="governed-journey-participant" data-boussole-state={invitation ? "invitation-prepared" : "expected"} className="rounded-lg border bg-slate-50 p-4">
                  <p className="font-semibold text-slate-950">{participant.name}</p>
                  <p className="mt-1 text-sm text-slate-600">{participant.role}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-700">État : {participantGovernedInvitations.some((item) => item.status === "ACTIVE" && new Date(item.expiresAt) > new Date() && (item.consentStatus === null || item.consentStatus === "ACCEPTED")) ? "Participation acceptée" : participantGovernedInvitations.some((item) => item.consentStatus === "DECLINED") ? "Invitation refusée" : invitation ? "Invitation en attente" : "Invitation à préparer"}</p>
                  <details className="mt-2"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-slate-700">Voir les droits</summary><div className="rounded-lg bg-white p-3 text-sm text-slate-700"><p><strong>Rôle prévu :</strong> {participant.role}</p><p className="mt-1">{participantGovernedInvitations.some((item) => item.status === "ACTIVE" && new Date(item.expiresAt) > new Date() && (item.consentStatus === null || item.consentStatus === "ACCEPTED")) ? "Peut consulter les éléments accessibles de ce parcours avec son lien personnel." : "Aucun accès au parcours n’est encore ouvert."}</p><p className="mt-1 text-xs">L’accès à chaque réunion est géré séparément.</p></div></details>
                  {!isOrganizer ? <details className="mt-3 rounded-lg border bg-white p-3"><summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-[#247f88]">{invitation ? "Modifier l’invitation au parcours" : "Inviter au parcours"}</summary>
                  {invitation ? (
                    <div className="mt-4 space-y-3">
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                        <p className="font-bold">Invitation préparée · Non envoyée</p>
                        {invitation.email ? <p className="mt-2 text-sm">Email prepare : {invitation.email}</p> : null}
                        {invitation.note ? <p className="mt-1 text-sm">Note : {invitation.note}</p> : null}
                        <p className="mt-2 text-xs text-emerald-800">
                          Prepare le {formatDate(invitation.preparedAt)}. Derniere mise a jour : {formatDate(invitation.updatedAt)}.
                        </p>
                      </div>
                      <div className="rounded-lg border bg-white p-3">
                        <p className="text-sm font-bold text-slate-950">Message</p>
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
                        <p className="text-sm font-bold text-slate-950">Modifier l’invitation</p>
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
                          Mettre à jour l’invitation
                        </button>
                      </form>
                    </div>
                  ) : (
                    <form action={prepareParticipantInvitationAction} className="mt-4 rounded-lg border bg-white p-3">
                      <input type="hidden" name="formTemplateId" value={formTemplate.id} />
                      <input type="hidden" name="participantName" value={participant.name} />
                      <input type="hidden" name="participantRole" value={participant.role} />
                      <p className="text-sm font-bold text-slate-950">Inviter au parcours</p>
                      <div className="mt-2 rounded-lg bg-cyan-50 p-3 text-sm text-slate-700"><p><strong>Parcours :</strong> « {title} »</p>{!equivalentJourneyText(objective, title) ? <p className="mt-1"><strong>Objectif :</strong> {objective}</p> : null}<p className="mt-1"><strong>Rôle proposé :</strong> {participant.role}</p><p className="mt-2 text-xs">Cette invitation concerne le parcours, pas automatiquement toutes ses réunions.</p></div>
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
                          Message
                          <textarea
                            name="optionalNote"
                            className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950"
                            placeholder="Votre message"
                          />
                        </label>
                        <details className="rounded-lg border bg-slate-50 p-3">
                          <summary className="cursor-pointer text-xs font-semibold text-slate-700">Options avancées</summary>
                        <label className="mt-3 block text-xs font-semibold text-slate-600">
                          Brouillon complet
                          <textarea
                            name="messageDraft"
                            defaultValue={messageDraft}
                            className="mt-1 min-h-40 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950"
                          />
                        </label></details>
                      </div>
                      <button type="submit" className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">
                        Préparer l’invitation
                      </button>
                    </form>
                  )}
                  <details className="mt-4 rounded-lg border bg-slate-50 p-3"><summary className="cursor-pointer text-sm font-semibold text-slate-700">Options avancées</summary><GovernedJourneyGuestAccessPanel
                    formTemplateId={formTemplate.id}
                    participantName={participant.name}
                    participantRole={participant.role}
                    governedRole={governedRoleFromParticipant(participant.role)}
                    preparedEmail={invitation?.email}
                    invitations={participantGovernedInvitations}
                    relationCases={(formTemplate.relationTemplate?.relationCases ?? []).map((relationCase) => ({ id: relationCase.id, label: relationCase.candidateName || `Dossier ${relationCase.id}` }))}
                  /></details>
                  </details> : null}
                </article>
                );
              })}
            </div>
          )}
          {additionalActiveParticipants.map((participant) => <article key={participant.id} className="mt-3 rounded-lg border bg-slate-50 p-4"><p className="font-semibold text-slate-950">{participant.displayName}</p><p className="mt-1 text-sm text-slate-600">{governedInvitationRoleLabel(participant.role)}</p><p className="mt-1 text-sm font-semibold text-slate-700">État : Accès actif</p></article>)}
          </div></details> : null}
        </section>
        </div>
      </section>

      <section id="work" className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-950">Le travail</h2>
        <section data-boussole-id="governed-journey-documents" className="mt-5">
          <h3 className="text-xl font-bold text-slate-950">Documents</h3>
          {documents.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Aucun document attendu n’a été renseigné.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {documents.map((document, index) => {
                const reception = documentReceptions.find((item) => documentKey(item.documentName) === documentKey(document.name));

                return (
                <article key={`${document.name}-${index}`} data-boussole-id="governed-journey-document" data-boussole-state={reception ? "received" : "pending"} className="rounded-lg border bg-slate-50 p-4">
                  <p className="font-semibold text-slate-950">{document.name}</p>
                  <p className="mt-1 text-sm text-slate-600">{document.reason}</p>
                  {reception ? (
                    <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                      <p className="font-bold">Reçu</p>
                      {reception.reference ? <p className="mt-2 text-sm">Reference : {reception.reference}</p> : null}
                      {reception.note ? <p className="mt-1 text-sm">Note : {reception.note}</p> : null}
                      <p className="mt-2 text-xs text-emerald-800">Declare le {formatDate(reception.receivedAt)}.</p>
                    </div>
                  ) : (
                    <form action={declareDocumentReceptionAction} className="mt-4 rounded-lg border bg-white p-3">
                      <input type="hidden" name="formTemplateId" value={formTemplate.id} />
                      <input type="hidden" name="documentName" value={document.name} />
                      <button type="submit" className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">
                        Marquer comme reçu
                      </button>
                      <details className="mt-3 rounded-lg border bg-slate-50 p-3"><summary className="cursor-pointer text-xs font-semibold text-slate-700">Options avancées</summary><div className="mt-3 grid gap-3">
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
                      </div></details>
                    </form>
                  )}
                  {!reception ? (
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    {document.required ? "Obligatoire" : "Optionnel"} · En attente
                  </p>
                  ) : (
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    {document.required ? "Obligatoire" : "Optionnel"} · Reçu
                  </p>
                  )}
                </article>
                );
              })}
            </div>
          )}
        </section>

      <details className="mt-6 rounded-lg border bg-slate-50"><summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-bold text-slate-700">Autres éléments du parcours</summary><div className="grid gap-6 border-t p-4 lg:grid-cols-2">
        <section data-boussole-id="governed-journey-first-actions" className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Principes de confidentialité proposés</h2>
          <p className="mt-2 text-sm text-slate-600">Ils décrivent le cadre souhaité à la création et ne remplacent pas les contrôles techniques d’accès.</p>
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
          <h2 className="text-xl font-bold text-slate-950">Premières étapes envisagées à la création</h2>
          {firstActions.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Aucune première action n’a été renseignée.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {firstActions.map((action, index) => (
                <article key={`${action.title}-${index}`} className="rounded-lg border bg-slate-50 p-4">
                  <p className="font-semibold text-slate-950">{action.title}</p>
                  <p className="mt-1 text-sm text-slate-600">Responsable : {action.owner}</p>
                  {action.dueHint ? <p className="mt-1 text-sm text-slate-500">Échéance : {action.dueHint}</p> : null}
                  <p className="mt-2 text-xs font-semibold text-slate-500">Prévue à la création · Aucun état d’exécution suivi ici</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div></details>

      <section data-boussole-id="governed-communications" className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold text-slate-950">Réunions et échanges</h3>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {communicationCapabilities.map((capability) => (
              <details key={capability.channelType} className="rounded-lg border bg-slate-50 p-4">
                <summary className="cursor-pointer text-sm font-bold text-slate-950">
                  Préparer une réunion
                </summary>
                <form action={prepareGovernanceMultiActorCommunicationAction} className="mt-4 space-y-3">
                  <input type="hidden" name="formTemplateId" value={formTemplate.id} />
                  <input type="hidden" name="workspaceId" value={attachedWorkspaceId ?? ""} />
                  <input type="hidden" name="channelType" value={capability.channelType} />
                  <label className="block text-xs font-semibold text-slate-600">
                    Titre
                    <input
                      name="title"
                      required
                      maxLength={140}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950"
                      placeholder="Titre de la réunion"
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
                    <legend className="px-1 text-xs font-semibold text-slate-600">Participants prévus</legend>
                    <p className="mb-2 text-xs text-slate-500">Vous pouvez préparer la réunion avant l’ouverture des accès. La sélection indique les personnes envisagées ; elle ne vaut ni acceptation du parcours ni confirmation de présence.</p>
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
                              <span className="block text-slate-500">Invitation au parcours en préparation · aucun accès ouvert</span>
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
                  <p className="text-xs text-slate-500">Brouillon</p>
                </form>
              </details>
            ))}
        </div>

        {communicationOverview.sessions.length > 0 ? (
          <>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {primaryMeetings.map((session, index) => (
              <article id={`meeting-${session.id}`} key={session.id} data-boussole-id="governed-journey-communication" data-boussole-state={session.status} className={`rounded-lg border border-emerald-200 bg-emerald-50 p-4 ${searchParams.meetingPrepared === session.title ? "ring-4 ring-emerald-200" : ""}`}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div data-boussole-id={index === 0 ? "governed-journey-secure-communication" : undefined}>
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
                <p className="mt-2 text-sm text-emerald-950">Accès à la réunion : {meetingParticipants.filter((item) => item.communicationSessionId === session.id && item.status === "AUTHORIZED").length} personne(s) · {session.attendance.length} présence(s) observée(s)</p>
                {meetingParticipants.every((item) => item.communicationSessionId !== session.id || item.status !== "AUTHORIZED") && !meetingIsClosed(session) ? <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-950">Aucun autre participant n’est prévu pour cette réunion. Vous pouvez en ajouter ou ouvrir quand même.</p> : null}
                {session.status !== "COMPLETED" && session.status !== "CANCELLED" && !(session.expiresAt && session.expiresAt <= new Date()) ? (
                  <div className="mt-3">
                    <Link data-boussole-id="governed-journey-media-room" href={`/gouvernance/parcours/${formTemplate.id}/reunions/${session.id}`} className="inline-flex min-h-11 items-center rounded-xl bg-[#247f88] px-4 py-2 font-semibold text-white">{meetingParticipants.some((item) => item.communicationSessionId === session.id && item.status === "AUTHORIZED") ? "Ouvrir la salle" : "Ouvrir quand même"}</Link>
                  </div>
                ) : null}
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
                {!meetingIsClosed(session) ? <>
                <div data-boussole-id="governed-journey-meeting-participants" className="mt-3 rounded-lg border border-emerald-200 bg-white/80 p-3"><p className="text-sm font-bold text-emerald-950">Participants de cette réunion</p>{meetingParticipants.some((item) => item.communicationSessionId === session.id && item.status === "AUTHORIZED") ? <ul className="mt-2 space-y-2">{meetingParticipants.filter((item) => item.communicationSessionId === session.id && item.status === "AUTHORIZED").map((item) => ({ item, invitation: governedInvitations.find((invitation) => invitation.id === item.governedJourneyInvitationId) })).filter(({ invitation }) => Boolean(invitation)).map(({ item, invitation }) => <li key={invitation!.id} className="text-sm text-slate-700"><strong>{invitation!.displayName}</strong> · {meetingRsvpLabel(item.rsvp)}</li>)}</ul> : <p className="mt-2 text-sm text-slate-600">Aucun participant ajouté.</p>}</div>
                <details className="mt-3 rounded-lg border border-emerald-200 bg-white/80 p-3"><summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-emerald-950">Ajouter des participants</summary>
                <p className="mb-3 text-xs text-emerald-800">Les personnes sélectionnées auront accès à cette réunion. Être participant du parcours ne donne pas automatiquement accès à toutes les réunions.</p>
                <div className="mt-3 rounded-lg border border-emerald-200 bg-white/80 p-3">
                  <p className="text-sm font-bold text-emerald-950">Participants ayant accès à cette réunion</p>
                  <p className="mt-1 text-xs text-emerald-800">Cet accès ne signifie pas que la personne a confirmé sa présence.</p>
                  {session.status === "COMPLETED" || session.status === "CANCELLED" || Boolean(session.expiresAt && session.expiresAt <= new Date()) ? <p className="mt-1 text-xs font-bold text-slate-600">Périmètre verrouillé</p> : null}
                  {meetingParticipants.every((item) => item.communicationSessionId !== session.id || item.status !== "AUTHORIZED") ? <p className="mt-2 text-sm font-semibold text-slate-700">Aucun participant ne dispose encore d’un accès à cette réunion.</p> : null}
                  {(() => { const metadata = asRecord(session.metadata); return !Array.isArray(metadata.selectedParticipantInvitationIds) ? <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Cette réunion a été préparée avant la sélection par réunion. Ajoutez les participants ci-dessous.</p> : null; })()}
                  {governedInvitations.length === 0 ? <p className="mt-2 text-sm text-slate-600">Aucun participant ne dispose encore d’un accès au parcours. <a href="#people" className="font-bold underline">Inviter d’abord au parcours</a>.</p> : (
                    <div className="mt-2 space-y-2">
                      {governedInvitations.map((invitation) => {
                        const assignment = meetingParticipants.find((item) => item.communicationSessionId === session.id && item.governedJourneyInvitationId === invitation.id);
                        const invitationMetadata = asRecord(invitation.metadata);
                        const selectedPreviously = governedMeetingSelectedPreparedIds(session.metadata, session.note).some((preparedId) => participantInvitations.some((prepared) => prepared.invitationId === preparedId && prepared.participantName.toLocaleLowerCase("fr") === invitation.displayName.toLocaleLowerCase("fr") && (!text(invitationMetadata.participantRole) || prepared.participantRole.toLocaleLowerCase("fr") === text(invitationMetadata.participantRole)?.toLocaleLowerCase("fr"))));
                        const expired = invitation.accessTokenExpiresAt <= new Date();
                        const unavailable = invitation.status !== "ACTIVE" || Boolean(invitation.revokedAt) || expired || Boolean(invitation.consent && invitation.consent.status !== "ACCEPTED");
                        const authorized = assignment?.status === "AUTHORIZED" && !unavailable;
                        const status = invitation.revokedAt || invitation.status === "REVOKED" ? "Accès retiré" : expired || invitation.status === "EXPIRED" ? "Accès expiré" : authorized ? "Accès à la réunion" : selectedPreviously ? "Participant prévu · accès à ouvrir" : "Sans accès à cette réunion";
                        return <div key={invitation.id} className="flex flex-col gap-2 rounded-lg border bg-white p-2 sm:flex-row sm:items-center sm:justify-between">
                          <div><p className="font-semibold text-slate-900">{invitation.displayName}</p><p className="text-xs text-slate-600">{governedInvitationRoleLabel(invitation.role)} · Membre du parcours · {status}</p></div>
                          {!unavailable && session.status !== "COMPLETED" && session.status !== "CANCELLED" && !(session.expiresAt && session.expiresAt <= new Date()) ? <form action={authorized ? removeGuestFromGovernedMeetingAction : authorizeGuestForGovernedMeetingAction}>
                            <input type="hidden" name="formTemplateId" value={formTemplate.id} /><input type="hidden" name="communicationSessionId" value={session.id} /><input type="hidden" name="invitationId" value={invitation.id} />
                            <button className="min-h-11 rounded-lg border px-3 py-2 text-xs font-bold text-slate-700" type="submit">{authorized ? "Retirer l’accès à cette réunion" : "Donner accès à cette réunion"}</button>
                          </form> : null}
                        </div>;
                      })}
                    </div>
                  )}
                  {participantInvitations.filter((prepared) => !governedInvitations.some((invitation) => {
                    const metadata = asRecord(invitation.metadata);
                    return (text(metadata.participantName) ?? invitation.displayName).toLocaleLowerCase("fr") === prepared.participantName.toLocaleLowerCase("fr");
                  })).map((prepared) => <div key={prepared.invitationId} className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3"><p className="font-semibold text-slate-900">{prepared.participantName}</p><p className="text-xs text-amber-900">{prepared.participantRole} · Invitation au parcours en attente · Pas encore ajoutable à la réunion</p><a href="#people" className="mt-2 inline-flex min-h-11 items-center text-xs font-bold text-amber-950 underline">Inviter d’abord au parcours</a></div>)}
                  <GovernedMeetingParticipantSelection
                    key={latestSelectionBySession.get(session.id) ? `${latestSelectionBySession.get(session.id)!.id}:${latestSelectionBySession.get(session.id)!.version}` : "empty"}
                    formTemplateId={formTemplate.id}
                    communicationSessionId={session.id}
                    candidateCount={candidateCountBySession.get(session.id) ?? 0}
                    selection={(() => {
                      const selection = latestSelectionBySession.get(session.id);
                      if (!selection) return null;
                      const rawSummary = asRecord(selection.materializationSummary);
                      return {
                        id: selection.id,
                        status: selection.status,
                        version: selection.version,
                        items: selection.items.map((item) => ({ id: item.id, snapshotDisplayName: item.snapshotDisplayName, observedEligibility: item.observedEligibility, decision: item.decision, decisionReason: item.decisionReason })),
                        materializationSummary: selection.materializationSummary ? { retained: Number(rawSummary.retained ?? 0), added: Number(rawSummary.added ?? 0), alreadyPresent: Number(rawSummary.alreadyPresent ?? 0), errors: Number(rawSummary.errors ?? 0) } : null,
                      };
                    })()}
                  />
                </div>
                </details>
                {session.status === "PREPARED_NOT_STARTED" ? <details id={`meeting-schedule-${session.id}`} open={searchParams.meetingAction === "schedule" && searchParams.meetingId === session.id} className="mt-3 rounded-lg border border-slate-200 bg-white/80 p-3"><summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-emerald-950">{session.scheduledAt ? "Modifier la date" : "Définir la date"}</summary><div className="grid gap-3 border-t pt-3">
                  <form action={updateGovernedMeetingScheduleAction} className="flex flex-wrap items-end gap-2"><input type="hidden" name="formTemplateId" value={formTemplate.id} /><input type="hidden" name="communicationSessionId" value={session.id} /><label className="text-xs font-semibold text-slate-600">{session.scheduledAt ? "Reporter / modifier la date" : "Définir la date"}<input required name="scheduledAt" type="datetime-local" className="mt-1 block min-h-11 rounded-lg border px-3 py-2 text-sm font-normal" /></label><button type="submit" className="min-h-11 rounded-lg border px-3 py-2 text-xs font-bold text-slate-700">Enregistrer la date</button></form>
                  <form action={cancelGovernedMeetingAction}><input type="hidden" name="formTemplateId" value={formTemplate.id} /><input type="hidden" name="communicationSessionId" value={session.id} /><ConfirmMeetingCancellationButton /></form>
                </div></details> : null}
                </> : session.status === "CANCELLED" ? <p className="mt-3 rounded-lg bg-slate-100 p-3 text-sm font-semibold text-slate-700">Réunion annulée. Périmètre conservé pour historique.</p> : null}
                <dl className="mt-3 grid gap-2 rounded-lg bg-white/80 p-3 text-xs text-emerald-950 sm:grid-cols-2">
                  <div><dt className="font-semibold">Date prévue</dt><dd>{session.scheduledAt ? formatDate(session.scheduledAt) : "Non planifiée"}</dd></div>
                  <div><dt className="font-semibold">Accès</dt><dd>{session.accessOpened ? "Disponible" : meetingIsClosed(session) ? "Fermé" : "Pas encore ouvert"}</dd></div>
                  <div><dt className="font-semibold">Enregistrement</dt><dd>Non</dd></div>
                  <div><dt className="font-semibold">Transcription</dt><dd>Non</dd></div>
                </dl>
              </article>
            ))}
          </div>
          <details className="mt-4 rounded-lg border bg-slate-50"><summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-bold text-cyan-900">Voir toutes les réunions ({communicationOverview.sessions.length})</summary><div className="space-y-5 border-t p-4">
            {(["En préparation", "À venir", "Terminées"] as const).map((category) => {
              const meetings = communicationOverview.sessions.filter((meeting) => meetingListCategory(meeting) === category);
              return meetings.length > 0 ? <section key={category}><h4 className="font-bold text-slate-900">{category}</h4><div className="mt-2 space-y-2">{meetings.map((meeting) => {
                const historical = meetingIsClosed(meeting);
                const historicalParticipants = meetingParticipants.filter((participant) => participant.communicationSessionId === meeting.id);
                if (!historical) return <div key={meeting.id} className="flex min-w-0 flex-col gap-1 rounded-lg bg-white p-3 text-sm sm:flex-row sm:items-center sm:justify-between"><span className="min-w-0 break-words"><strong>{meeting.title}</strong>{meeting.scheduledAt ? ` · ${formatDate(meeting.scheduledAt)}` : " · Date non définie"}</span><span className="text-xs font-semibold text-slate-600">{meeting.statusLabel}</span></div>;
                const reusableHistoricalIds = new Set(historicalParticipants.filter((participant) => hasCurrentJourneyAccess(participant.governedJourneyInvitation)).map((participant) => participant.governedJourneyInvitationId));
                const reusableCount = reusableHistoricalIds.size;
                const attentionCount = historicalParticipants.length - reusableCount;
                return <details key={meeting.id} className="rounded-lg border bg-white"><summary className="flex min-h-11 cursor-pointer list-none flex-col gap-1 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"><span className="min-w-0 break-words"><strong>{meeting.title}</strong>{meeting.scheduledAt ? ` · ${formatDate(meeting.scheduledAt)}` : " · Date non définie"}</span><span className="text-xs font-semibold text-slate-600">{meeting.statusLabel}</span></summary><div className="space-y-4 border-t p-4 text-sm text-slate-700">
                  <dl className="grid gap-3 sm:grid-cols-2">
                    <div><dt className="font-semibold text-slate-900">Date prévue</dt><dd>{meeting.scheduledAt ? formatDate(meeting.scheduledAt) : "Non planifiée"}</dd></div>
                    <div><dt className="font-semibold text-slate-900">Expiration</dt><dd>{meeting.expiresAt ? formatDate(meeting.expiresAt) : "Sans expiration enregistrée"}</dd></div>
                    <div><dt className="font-semibold text-slate-900">Objectif</dt><dd>{meeting.purpose ?? "Non renseigné"}</dd></div>
                    <div><dt className="font-semibold text-slate-900">Note</dt><dd className="whitespace-pre-wrap">{governedMeetingUserNote(meeting.note) ?? "Non renseignée"}</dd></div>
                  </dl>
                  <section><h5 className="font-bold text-slate-950">Participants de cette réunion</h5>{historicalParticipants.length > 0 ? <ul className="mt-2 space-y-3">{historicalParticipants.map((participant) => {
                    const invitation = participant.governedJourneyInvitation;
                    const rsvpActor = participant.rsvp?.decidedByUser?.name ?? participant.rsvp?.decidedByUser?.email ?? participant.rsvp?.decidedByInvitation?.displayName ?? null;
                    return <li key={participant.id} className="rounded-lg bg-slate-50 p-3"><p><strong>{invitation.inviteeUser?.name ?? invitation.inviteeUser?.email ?? invitation.displayName}</strong></p><p className="mt-1">Autorisation historique : {participant.status === "AUTHORIZED" ? "accordée" : "retirée"}{participant.removedAt ? ` le ${formatDate(participant.removedAt)}` : ` le ${formatDate(participant.authorizedAt)}`}</p><p className="mt-1">RSVP : {meetingRsvpLabel(participant.rsvp)}{participant.rsvp?.decidedAt ? ` le ${formatDate(participant.rsvp.decidedAt)}` : ""}{rsvpActor ? ` par ${rsvpActor}` : ""}</p>{participant.rsvpEvents.length > 0 ? <details className="mt-2"><summary className="cursor-pointer font-semibold text-cyan-900">Historique RSVP ({participant.rsvpEvents.length})</summary><ol className="mt-2 space-y-1 border-l pl-3">{participant.rsvpEvents.map((event) => <li key={event.id}>{meetingRsvpEventLabel(event.type)} · {event.actorUser?.name ?? event.actorUser?.email ?? event.actorInvitation?.displayName ?? (event.actorKind === "ORGANIZER" ? "Organisateur" : event.actorKind === "SYSTEM" ? "Système" : "Invité")} · {formatDate(event.occurredAt)}</li>)}</ol></details> : <p className="mt-2 text-xs text-slate-500">Aucun historique RSVP enregistré.</p>}</li>;
                  })}</ul> : <p className="mt-2 text-slate-500">Aucun participant historique enregistré.</p>}</section>
                  <section><h5 className="font-bold text-slate-950">Présence observée</h5>{meeting.attendance.length > 0 ? <ul className="mt-2 space-y-2">{meeting.attendance.map((presence) => <li key={presence.participantKey} className="rounded-lg bg-slate-50 p-3"><strong>{presence.displayName}</strong><p>Arrivée observée : {formatDate(presence.joinedAt)}</p><p>{presence.leftAt ? `Départ observé : ${formatDate(presence.leftAt)}` : "Départ non observé"}</p><p>Médias observés : {[presence.mediaUsed.audio ? "audio" : null, presence.mediaUsed.video ? "vidéo" : null, presence.mediaUsed.screen ? "partage d’écran" : null].filter(Boolean).join(", ") || "aucun"}</p></li>)}</ul> : <p className="mt-2 text-slate-500">Aucune présence observée.</p>}<p className="mt-2 text-xs text-slate-500">Observation technique, distincte du RSVP et ne constituant pas une preuve certifiée de présence.</p></section>
                  <dl className="grid gap-3 sm:grid-cols-2"><div className="rounded-lg bg-slate-50 p-3"><dt className="font-semibold text-slate-900">Enregistrement</dt><dd>Aucun contenu conservé</dd></div><div className="rounded-lg bg-slate-50 p-3"><dt className="font-semibold text-slate-900">Transcription</dt><dd>Aucun contenu conservé</dd></div></dl>
                  <details className="rounded-lg border border-cyan-200 bg-cyan-50"><summary className="min-h-11 cursor-pointer px-4 py-3 font-bold text-cyan-950">Réutiliser cette réunion</summary><form action={reusePastGovernedMeetingAction} className="space-y-4 border-t border-cyan-200 p-4"><input type="hidden" name="formTemplateId" value={formTemplate.id} /><input type="hidden" name="sourceSessionId" value={meeting.id} /><p className="text-xs text-cyan-900">Une nouvelle réunion sera créée. Cette réunion historique restera inchangée.</p><div className="grid gap-3 sm:grid-cols-2"><label className="font-semibold">Titre<input name="title" required defaultValue={meeting.title} className="mt-1 block w-full rounded-lg border bg-white px-3 py-2 font-normal" /></label><label className="font-semibold">Nouvelle date<input name="scheduledAt" required type="datetime-local" className="mt-1 block w-full rounded-lg border bg-white px-3 py-2 font-normal" /></label><label className="font-semibold sm:col-span-2">Objectif<input name="purpose" defaultValue={meeting.purpose ?? ""} className="mt-1 block w-full rounded-lg border bg-white px-3 py-2 font-normal" /></label><label className="font-semibold sm:col-span-2">Note<textarea name="note" defaultValue={governedMeetingUserNote(meeting.note) ?? ""} className="mt-1 block min-h-20 w-full rounded-lg border bg-white px-3 py-2 font-normal" /></label></div><div><p className="font-semibold">Participants proposés</p><p className="mt-1 text-xs text-cyan-900">{reusableCount} participant(s) historique(s) peuvent être repris · {attentionCount} nécessitent votre attention.</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{governedInvitations.map((invitation) => { const reusable = hasCurrentJourneyAccess(invitation); const wasParticipant = historicalParticipants.some((participant) => participant.governedJourneyInvitationId === invitation.id); const state = reusable ? "Réutilisable immédiatement" : invitation.revokedAt || invitation.status === "REVOKED" ? "Accès Journey perdu ou révoqué" : invitation.accessTokenExpiresAt <= new Date() ? "Invitation expirée ou invalide" : "Action humaine nécessaire"; return <label key={invitation.id} className={`rounded-lg border p-3 ${reusable ? "bg-white" : "bg-slate-100 text-slate-500"}`}><input type="checkbox" name="invitationIds" value={invitation.id} defaultChecked={wasParticipant && reusable} disabled={!reusable} className="mr-2" /><strong>{invitation.inviteeUser?.name ?? invitation.inviteeUser?.email ?? invitation.displayName}</strong><span className="mt-1 block text-xs">{state}</span></label>; })}</div></div><div className="rounded-lg bg-white p-3 text-xs"><strong>Réglages proposés :</strong> salle non ouverte, aucun token média, aucun enregistrement, aucune transcription, nouveaux RSVP en attente lorsque requis.</div><button type="submit" className="min-h-11 rounded-lg bg-cyan-900 px-4 py-2 font-bold text-white">Créer la nouvelle réunion</button></form></details>
                </div></details>;
              })}</div></section> : null;
            })}
          </div></details>
          </>
        ) : (
          <p className="mt-5 rounded-lg border bg-slate-50 p-4 text-sm text-slate-600">
            Aucune réunion n'est préparée pour ce parcours.
          </p>
        )}
      </section>

      <section id="decisions" data-boussole-id="governance-reviews" className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-950">Les décisions</h2>
            <p className="mt-2 text-sm text-slate-600">Décisions à préparer ou déjà examinées.</p>
          </div>
        </div>

        {governanceReviewPreparations.length > 0 ? (
          <div className="mt-5 space-y-3">
            {governanceReviewPreparations.map((review) => (
              <article id={`governance-review-${review.reviewPreparationId}`} data-boussole-id="open-governance-review" key={review.reviewPreparationId} className="scroll-mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold text-emerald-950">Décision</p><span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-800 ring-1 ring-emerald-200">{review.status === "PREPARED_NOT_STARTED" ? "Préparée" : review.status === "IN_HUMAN_REVIEW" ? "En cours" : "Examinée"}</span></div>
                <div className="mt-3 grid gap-3 text-sm lg:grid-cols-2">
                  <div className="rounded-lg bg-white/80 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Sujet</p>
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
                {review.status !== "COMPLETED" ? (
                  <form action={transitionGovernanceReviewAction} className="mt-3">
                    <input type="hidden" name="formTemplateId" value={formTemplate.id} />
                    <input type="hidden" name="reviewPreparationId" value={review.reviewPreparationId} />
                    <input type="hidden" name="nextStatus" value={review.status === "PREPARED_NOT_STARTED" ? "IN_HUMAN_REVIEW" : "COMPLETED"} />
                    <input type="hidden" name="humanConfirmed" value="yes" />
                    <ConfirmGovernanceReviewTransitionButton nextStatus={review.status === "PREPARED_NOT_STARTED" ? "IN_HUMAN_REVIEW" : "COMPLETED"} />
                  </form>
                ) : null}
                {review.startedAt ? <p className="mt-2 text-xs font-semibold text-emerald-800">Examen commencé le {formatDate(review.startedAt)}.</p> : null}
                {review.completedAt ? <p className="mt-1 text-xs font-semibold text-emerald-800">Décision examinée le {formatDate(review.completedAt)}.</p> : null}
                <details className="mt-3 rounded-lg border bg-white/80 p-3"><summary className="cursor-pointer text-sm font-semibold text-emerald-950">Options avancées</summary><GovernanceReviewAIAssistant formTemplateId={formTemplate.id} reason={review.reason} question={review.question} humanNote={review.note} /></details>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-lg border bg-slate-50 p-4 text-sm text-slate-600">
            Aucune décision à prendre pour le moment.
          </p>
        )}

        <form action={prepareGovernanceReviewAction} data-boussole-id="prepare-governance-review" className="mt-5 rounded-lg border bg-slate-50 p-4">
          <input type="hidden" name="formTemplateId" value={formTemplate.id} />
          <p className="text-sm font-bold text-slate-950">Préparer une décision</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600">
              Sujet
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
                placeholder="Contexte utile à la décision"
              />
            </label>
          </div>
          <button type="submit" className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">
            Préparer la décision
          </button>
        </form>
      </section>

      {governedMemory && governedMemoryJourney ? <GovernedJourneyMemorySection
        memory={governedMemory}
        context={{
          journeyId: governedMemoryJourney.id,
          relationCaseId: governedMemoryJourney.relationCaseId ?? governedMemoryJourney.relationCaseContexts[0]?.relationCaseId ?? null,
          formTemplateId: formTemplate.id,
        }}
      /> : null}

      <section id="history" className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-950">Historique</h2>
        <p className="mt-2 text-sm text-slate-600">Ce qui s’est passé dans ce parcours. La mémoire ci-dessus décrit séparément ce qui est retenu aujourd’hui.</p>
        {initialHistory.length > 0 ? <ol className="mt-4 space-y-3">{initialHistory.map((item) => <HistoryItem key={item.key} item={item} />)}</ol> : <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Aucun événement à afficher.</p>}
        {additionalHistory.length > 0 ? <details className="mt-4 rounded-lg border bg-slate-50"><summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-bold text-cyan-900">Afficher plus ({additionalHistory.length})</summary><ol className="space-y-3 border-t p-4">{additionalHistory.map((item) => <HistoryItem key={item.key} item={item} />)}</ol></details> : null}
      </section>
      </section>

      <details data-boussole-id="governed-journey-v1-limits" className="mt-6 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-900">
        <summary className="min-h-11 cursor-pointer px-5 py-4 font-bold">Fonctionnement et garanties</summary><div className="border-t border-amber-200 p-5">
        <ul className="list-disc space-y-2 pl-5 leading-relaxed">
          <li>Les actions importantes restent sous votre contrôle.</li>
          <li>Les accès sont limités aux personnes autorisées.</li>
          <li>Les décisions et l’historique ne sont pas modifiés automatiquement.</li>
          <li>Goodissima n’envoie ni invitation ni décision sans action explicite.</li>
        </ul>
      </div></details>
    </main>
  );
}

function HistoryItem({ item }: { item: { occurredAt: string; text: string; detail?: string | null } }) {
  return <li className="min-w-0 rounded-lg border bg-slate-50 p-3">
    <time dateTime={item.occurredAt} className="text-xs font-semibold text-slate-500">{formatDate(item.occurredAt)}</time>
    <p className="mt-1 break-words text-sm font-semibold text-slate-900">{item.text}</p>
    {item.detail ? <p className="mt-1 line-clamp-2 break-words text-sm text-slate-600">« {item.detail} »</p> : null}
  </li>;
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-2xl font-bold text-slate-950">{value}</dd>
    </div>
  );
}
