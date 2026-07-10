import { CandidateAccessControls } from "@/components/CandidateAccessControls";
import { ActiveOrganizationBadge } from "@/components/ActiveOrganizationBadge";
import { AIWorkspace } from "@/components/AIWorkspace";
import { ChatBox } from "@/components/ChatBox";
import { DashboardBackLink } from "@/components/DashboardBackLink";
import { ProductContextBanner, ProductLifecycle, ProductObjectDefinition } from "@/components/ProductObjectClarity";
import { DebugDeleteCaseButton } from "@/components/DebugDeleteCaseButton";
import { DocumentList } from "@/components/DocumentList";
import { DocumentUpload } from "@/components/DocumentUpload";
import { MatchingOptInPanel } from "@/components/MatchingOptInPanel";
import { RelationCaseFields } from "@/components/RelationCaseFields";
import { RelationGovernanceBadge, RelationGovernanceControls } from "@/components/RelationGovernanceControls";
import { RelationSecureMediaRoom } from "@/components/RelationSecureMediaRoom";
import { RelationLiveKitMediaRoom } from "@/components/RelationLiveKitMediaRoom";
import { RelationActionsPanel } from "@/components/RelationActionsPanel";
import {
  attachRelationCaseToWorkspaceAction,
  detachRelationCaseFromWorkspaceAction,
} from "@/lib/governance-workspace-actions";
import type { GovernanceWorkspaceOption } from "@/lib/governance-workspace-repository";
import {
  getRelationActionStatusLabel,
  getRelationActionTypeLabel,
} from "@/lib/relation-actions";
import { candidateIdentityRecommendation, resolveCandidateIdentityState } from "@/lib/candidate-identity";
import { buildDossierSituation } from "@/lib/dossier-situation";
import { humanizeAIEvent, humanizeRelationEvent } from "@/lib/events/humanize";
import Link from "next/link";
import { canWriteInRelation, getRelationGovernanceBlockedMessage } from "@/lib/relation-governance";
import type {
  CommunicationChannelType,
  CommunicationProvider,
  CommunicationSessionStatus,
  IdentityStatus,
  Prisma,
  RelationGovernanceStatus,
  RelationPriority,
  RelationStatus,
} from "@prisma/client";
import Image from "next/image";

type RelationCaseWorkspaceItem = {
  id: string;
  candidateAccessToken: string;
  candidateAccessExpiresAt?: Date | string | null;
  candidateAccessRevokedAt?: Date | string | null;
  candidateName: string;
  candidateEmail?: string;
  matchingEnabled: boolean;
  priority: RelationPriority;
  status: RelationStatus;
  governanceStatus: RelationGovernanceStatus;
  governanceUpdatedAt?: Date | string | null;
  governanceReason?: string | null;
  candidateIdentity?: {
    id: string;
    status: IdentityStatus;
    credentials: Array<{
      id: string;
      issuedAt: Date | string;
      credentialType: {
        code: string;
        name: string;
      };
      issuerTrustedOrganization: {
        organizationId: string;
      };
    }>;
  } | null;
  gLink: { id: string; title: string; slug?: string | null };
  workspace?: {
    id: string;
    name: string;
    slug: string;
    category: string;
    kind: string;
  } | null;
  createdAt: Date | string;
  messages: Array<{
    id: string;
    body: string;
    senderType?: string;
    createdAt: Date | string;
  }>;
  documents: Array<{
    id: string;
    fileName: string;
    createdAt?: Date | string;
  }>;
  formSubmissions?: Array<{
    id: string;
    answers: Prisma.JsonValue;
    createdAt: Date | string;
    formTemplate: {
      name: string;
      fields: Array<{
        key: string;
        label: string;
        options?: Prisma.JsonValue | null;
        step: number;
        position: number;
        createdAt: Date | string;
      }>;
    };
  }>;
  relationActions: Array<{
    id: string;
    type: string;
    status: string;
    title: string;
    description?: string | null;
    payload?: Prisma.JsonValue | null;
    createdByRole: string;
    completedAt?: Date | string | null;
    createdAt: Date | string;
  }>;
  auditLogs: Array<{ id: string; eventType: string; createdAt: Date | string }>;
  relationEvents: Array<{
    id: string;
    type: string;
    actorType?: string | null;
    payload?: Prisma.JsonValue | null;
    createdAt: Date | string;
  }>;
  communicationSessions?: Array<{
    id: string;
    channelType: CommunicationChannelType;
    provider: CommunicationProvider;
    status: CommunicationSessionStatus;
    title: string;
    createdAt: Date | string;
    updatedAt: Date | string;
    expiresAt?: Date | string | null;
    recordingEnabled: boolean;
    transcriptionRequested: boolean;
    accessOpened?: boolean;
  }>;
};

type ActivityEvent = {
  id: string;
  label: string;
  date: Date | string;
  type: string;
  icon?: string;
  badge?: string;
  status?: string;
  actor?: string;
};

const parisDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatActivityDate(date: Date | string) {
  return parisDateFormatter.format(new Date(date));
}

const governanceAuditEventTypes = new Set([
  "ACCESS_INVITATION_CREATED",
  "ACCESS_INVITATION_ACCEPTED",
  "ACCESS_INVITATION_REVOKED",
  "DOCUMENT_UPLOADED",
  "CASE_CLOSED",
  "CASE_ARCHIVED",
  "CASE_RESTORED",
  "CANDIDATE_ACCESS_REVOKED",
  "CANDIDATE_ACCESS_REGENERATED",
  "DEBUG_TEST_CASE_CREATED",
  "GOVERNANCE_STATUS_CHANGED",
]);

const importantTimelineRelationEventTypes = new Set([
  "DOCUMENT_UPLOADED",
  "DOCUMENT_REQUEST_CREATED",
  "ACTION_CREATED",
  "ACTION_COMPLETED",
  "STATUS_CHANGED",
  "PRIORITY_CHANGED",
  "CASE_ARCHIVED",
  "CASE_RESTORED",
  "MATCHING_OPT_IN_CHANGED",
  "MATCHING_PROPOSED",
  "AI_SUGGESTED_ACTION_ACCEPTED",
  "AI_TIMELINE_SUGGESTION_ACCEPTED",
  "GOVERNANCE_STATUS_CHANGED",
]);

const communicationChannelLabels: Record<CommunicationChannelType, string> = {
  VOICE_IP: "Audio",
  VIDEO_IP: "Visio",
  SCREEN_SHARE: "Partage ecran",
};

const communicationStatusLabels: Record<CommunicationSessionStatus, string> = {
  REQUESTED: "Prete",
  PREPARED_NOT_STARTED: "Preparee",
  CANCELLED: "Expiree ou annulee",
  COMPLETED: "Terminee",
};

const communicationProviderLabels: Record<CommunicationProvider, string> = {
  NONE: "Aucun provider",
  MANUAL_EXTERNAL: "WebRTC navigateur",
  LIVEKIT_PENDING: "LiveKit non branche",
};

function getCommunicationDisplayTitle(session: {
  channelType: CommunicationChannelType;
  title: string;
}) {
  const title = session.title.toLowerCase();
  const mentionsVideo = title.includes("visio") || title.includes("video");
  const mentionsScreen = title.includes("partage") || title.includes("ecran");

  if ((session.channelType === "VIDEO_IP" && mentionsScreen) || (session.channelType === "SCREEN_SHARE" && mentionsVideo)) {
    return "Visio et partage d'ecran";
  }

  return communicationChannelLabels[session.channelType];
}

function getCommunicationDisplaySubtitle(session: {
  channelType: CommunicationChannelType;
  title: string;
  provider: CommunicationProvider;
}) {
  const displayTitle = getCommunicationDisplayTitle(session);
  if (displayTitle === "Visio et partage d'ecran") return "Session relationnelle mixte";
  if (session.title && session.title !== communicationChannelLabels[session.channelType]) return session.title;
  return communicationProviderLabels[session.provider];
}

function getCommunicationDisplayStatus(session: {
  provider?: CommunicationProvider;
  status: CommunicationSessionStatus;
  expiresAt?: Date | string | null;
  accessOpened?: boolean;
}) {
  if (session.status === "COMPLETED") return "Terminee";
  if (session.status === "CANCELLED") return session.expiresAt ? "Expiree" : "Annulee";
  if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) return "Expiree";
  if (session.status === "REQUESTED" && (session.provider === "MANUAL_EXTERNAL" || session.accessOpened)) return "En cours";
  return communicationStatusLabels[session.status];
}

function hasCommunicationMediaStarted(session: {
  provider: CommunicationProvider;
  accessOpened?: boolean;
}) {
  return session.provider === "MANUAL_EXTERNAL" || Boolean(session.accessOpened);
}

function getCommunicationProviderDisplay(session: {
  provider: CommunicationProvider;
  accessOpened?: boolean;
}) {
  if (hasCommunicationMediaStarted(session)) return "WebRTC navigateur";
  return communicationProviderLabels[session.provider];
}

function getCommunicationExpirationDisplay(session: {
  provider: CommunicationProvider;
  expiresAt?: Date | string | null;
  accessOpened?: boolean;
}) {
  if (session.expiresAt) return formatActivityDate(session.expiresAt);
  return hasCommunicationMediaStarted(session) ? "Non renseignee" : "Non definie";
}

function formatRelativeActivityDate(date: Date | string) {
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays >= 1) return `Il y a ${diffDays} jour${diffDays > 1 ? "s" : ""}`;
  if (diffHours >= 1) return `Il y a ${diffHours}h`;
  return `Il y a ${diffMinutes} min`;
}

function getPayloadString(payload: Prisma.JsonValue | null | undefined, key: string) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;

  const value = payload[key];
  return typeof value === "string" ? value : null;
}

function getRelationEventLabel(event: RelationCaseWorkspaceItem["relationEvents"][number]) {
  switch (event.type) {
    case "MESSAGE_SENT":
      return event.actorType === "OWNER"
        ? "Message envoye par proprietaire"
        : "Message envoye par candidat";
    case "DOCUMENT_UPLOADED":
      return event.actorType === "OWNER"
        ? "Document ajoute par proprietaire"
        : "Document ajoute par candidat";
    case "STATUS_CHANGED":
      return "Statut modifie";
    case "PRIORITY_CHANGED":
      return "Priorite modifiee";
    case "CASE_ARCHIVED":
      return "Dossier archive";
    case "CASE_RESTORED":
      return "Dossier reactive";
    case "ACTION_CREATED":
      return `Demande créée${getPayloadString(event.payload, "title") ? ` - ${getPayloadString(event.payload, "title")}` : ""}`;
    case "ACTION_COMPLETED":
      return `Demande complétée${getPayloadString(event.payload, "title") ? ` - ${getPayloadString(event.payload, "title")}` : ""}`;
    case "AI_SUGGESTED_ACTION_ACCEPTED":
      return `Suggestion IA acceptée${getPayloadString(event.payload, "title") ? ` - ${getPayloadString(event.payload, "title")}` : ""}`;
    case "AI_TIMELINE_SUGGESTION_ACCEPTED":
      return `Suggestion timeline IA acceptee${getPayloadString(event.payload, "title") ? ` - ${getPayloadString(event.payload, "title")}` : ""}`;
    case "AI_DRAFT_USED":
      return "Brouillon IA utilise dans l'editeur";
    default:
      return humanizeRelationEvent(
        event.type,
        event.payload && typeof event.payload === "object" && !Array.isArray(event.payload) ? event.payload : null,
      ).title;
  }
}

function getRelationEventType(eventType: string) {
  switch (eventType) {
    case "MESSAGE_SENT":
      return "Message";
    case "DOCUMENT_UPLOADED":
      return "Document";
    case "STATUS_CHANGED":
    case "PRIORITY_CHANGED":
    case "CASE_ARCHIVED":
    case "CASE_RESTORED":
      return "Dossier";
    case "ACTION_CREATED":
    case "ACTION_COMPLETED":
    case "AI_SUGGESTED_ACTION_ACCEPTED":
    case "AI_TIMELINE_SUGGESTION_ACCEPTED":
    case "AI_DRAFT_USED":
      return "Demande";
    default:
      return "Evenement";
  }
}

function getHumanizedRelationEventLabel(event: RelationCaseWorkspaceItem["relationEvents"][number]) {
  const humanized = humanizeRelationEvent(
    event.type,
    event.payload && typeof event.payload === "object" && !Array.isArray(event.payload) ? event.payload : null,
  );
  const payloadTitle = getPayloadString(event.payload, "title");
  return payloadTitle ? `${humanized.title} - ${payloadTitle}` : humanized.title;
}

function getHumanizedRelationEventType(eventType: string) {
  return humanizeRelationEvent(eventType).category ?? "Dossier";
}

const technicalAnswerFieldKeys = new Set(["notificationOptIn", "notificationEmail"]);
const technicalAnswerFieldPrefixes = ["notification", "_", "internal"];

function isTechnicalAnswerField(key: string) {
  return technicalAnswerFieldKeys.has(key) || technicalAnswerFieldPrefixes.some((prefix) => key.startsWith(prefix));
}

function getOptionLabel(options: Prisma.JsonValue | null | undefined, value: Prisma.JsonValue) {
  if (typeof value !== "string" || !Array.isArray(options)) return null;

  for (const option of options) {
    if (!option || typeof option !== "object" || Array.isArray(option)) continue;

    const optionValue = option.value;
    const optionLabel = option.label;

    if (optionValue === value && typeof optionLabel === "string") {
      return optionLabel;
    }
  }

  return null;
}

function getSubmissionAnswerEntries(submission: NonNullable<RelationCaseWorkspaceItem["formSubmissions"]>[number]) {
  if (!submission.answers || typeof submission.answers !== "object" || Array.isArray(submission.answers)) {
    return [];
  }

  const answers = submission.answers as Record<string, Prisma.JsonValue>;
  const displayedKeys = new Set<string>();
  const knownEntries = submission.formTemplate.fields
    .filter((field) => !isTechnicalAnswerField(field.key))
    .filter((field) => Object.prototype.hasOwnProperty.call(answers, field.key))
    .map((field) => {
      displayedKeys.add(field.key);
      return {
        key: field.key,
        label: field.label || field.key,
        value: getOptionLabel(field.options, answers[field.key]) ?? answers[field.key],
      };
    });
  const extraEntries = Object.entries(answers)
    .filter(([key]) => !displayedKeys.has(key))
    .filter(([key]) => !isTechnicalAnswerField(key))
    .map(([key, value]) => ({ key, label: key, value }));

  return [...knownEntries, ...extraEntries];
}

function formatSubmissionAnswer(value: Prisma.JsonValue): string {
  if (value === null || value === undefined || value === "") return "Non renseigné";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((item) => formatSubmissionAnswer(item)).join(", ");

  return JSON.stringify(value);
}

function getActiveCredentialCountLabel(count: number) {
  return `${count} credential${count > 1 ? "s" : ""} actif${count > 1 ? "s" : ""}`;
}

function getCredentialKindLabel(
  credential: NonNullable<RelationCaseWorkspaceItem["candidateIdentity"]>["credentials"][number],
) {
  return credential.credentialType.code === "CANDIDATE_CREATED" ||
    credential.issuerTrustedOrganization.organizationId === "GOODISSIMA_SYSTEM"
    ? "Lifecycle"
    : "Trust";
}

function getActivityEvents(item: RelationCaseWorkspaceItem): ActivityEvent[] {
  const eventDocumentIds = new Set(
    item.relationEvents
      .map((event) => getPayloadString(event.payload, "documentId"))
      .filter(Boolean),
  );

  const events = [
    {
      id: `case-${item.id}`,
      label: "Dossier créé",
      date: item.createdAt,
      type: "Dossier",
    },
    ...item.relationEvents
      .filter((event) => importantTimelineRelationEventTypes.has(event.type))
      .map((event) => ({
        id: `relation-event-${event.id}`,
        label: getHumanizedRelationEventLabel(event),
        date: event.createdAt,
        type: getHumanizedRelationEventType(event.type),
        icon: humanizeRelationEvent(
          event.type,
          event.payload && typeof event.payload === "object" && !Array.isArray(event.payload) ? event.payload : null,
        ).icon,
      })),
    ...item.documents
      .filter((document) => document.createdAt)
      .filter((document) => !eventDocumentIds.has(document.id))
      .map((document) => ({
        id: `document-${document.id}`,
        label: "Document ajoute dans le dossier",
        date: document.createdAt!,
        type: "Document",
      })),
    ...item.relationActions.map((action) => ({
      id: `action-${action.id}`,
      label: action.title,
      date: action.completedAt ?? action.createdAt,
      type: "Demande",
      badge: getRelationActionTypeLabel(action.type),
      status: getRelationActionStatusLabel(action.status),
      actor: action.createdByRole,
    })),
  ];

  return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function RelationCaseWorkspace({
  item,
  senderType,
  candidateAccessToken,
  organizationName,
  debugMode = false,
  workspaceOptions = [],
}: {
  item: RelationCaseWorkspaceItem;
  senderType: "OWNER" | "CANDIDATE";
  candidateAccessToken?: string;
  organizationName?: string | null;
  debugMode?: boolean;
  workspaceOptions?: GovernanceWorkspaceOption[];
}) {
  const activityEvents = getActivityEvents(item);
  const communicationSessions = item.communicationSessions ?? [];
  const governanceAuditLogs = item.auditLogs.filter((log) => governanceAuditEventTypes.has(log.eventType));
  const isCandidateView = senderType === "CANDIDATE";
  const formSubmissions = item.formSubmissions ?? [];
  const relationWritable = canWriteInRelation(item.governanceStatus);
  const governanceBlockedMessage = getRelationGovernanceBlockedMessage(item.governanceStatus);
  const candidateIdentityState = resolveCandidateIdentityState({
    id: item.id,
    candidateName: item.candidateName,
    candidateEmail: item.candidateEmail,
    identityVerificationStatus: item.candidateIdentity?.status,
  });
  const dossierSituation = buildDossierSituation({
    status: item.status,
    governanceStatus: item.governanceStatus,
    priority: item.priority,
    matchingEnabled: item.matchingEnabled,
    candidateIdentity: candidateIdentityState,
    createdAt: item.createdAt,
    documents: item.documents,
    relationActions: item.relationActions,
    relationEvents: item.relationEvents,
  });

  return (
    <main className="mx-auto max-w-[92rem] bg-[#fbf7f1] px-4 pb-8 pt-6 text-[#2f3437] sm:px-6 sm:py-10">
      {isCandidateView ? (
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Image
            src="/logo-goodissima.png"
            alt="Goodissima"
            width={240}
            height={104}
            priority
            className="h-auto w-44 sm:w-60"
          />
          <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-700">
            <span className="rounded-full bg-emerald-50 px-3 py-1 ring-1 ring-emerald-200">Conversation sécurisée</span>
            <span className="rounded-full bg-sky-50 px-3 py-1 ring-1 ring-sky-200">Documents proteges</span>
          </div>
        </div>
      ) : null}
      {!isCandidateView ? (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <DashboardBackLink />
          <ActiveOrganizationBadge organizationName={organizationName} className="border-[#d6e7e8] bg-[#fffcf8]" />
        </div>
      ) : null}
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#247f88]">Espace relationnel Goodissima</p>
      <h1 className="mt-2 text-2xl font-bold leading-tight text-[#2f3437] sm:text-3xl">{item.gLink.title}</h1>
      <ProductObjectDefinition object="workspace" />
      <p className="mt-1 text-sm leading-relaxed text-[#766f68] sm:text-base">
        Dossier avec {candidateIdentityState.displayName}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-[#e8f8f9] px-3 py-1 font-semibold text-[#247f88] ring-1 ring-[#d6e7e8]">
          {candidateIdentityState.status}
        </span>
        <span className="rounded-full bg-white px-3 py-1 font-medium text-[#766f68] ring-1 ring-[#e7e0d6]">
          {candidateIdentityState.displayEmail}
        </span>
        {candidateIdentityState.recommendation ? (
          <span className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-800 ring-1 ring-amber-200">
            {candidateIdentityRecommendation}
          </span>
        ) : null}
      </div>
      <div className="mt-4 max-w-xl">
        <RelationGovernanceBadge status={item.governanceStatus} reason={item.governanceReason} />
      </div>
      <div className="mt-6"><ProductLifecycle current="workspace" compact /><ProductContextBanner object="relation" /><div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4 text-sm"><span>Annonce d'origine : <strong>{item.gLink.title}</strong></span><Link href={`/links/${item.gLink.id}`} className="font-semibold text-[#247f88] underline">Voir l'annonce</Link></div></div>
      {!isCandidateView ? (
        <section className="mt-4 rounded-2xl border border-[#d6e7e8] bg-white p-4 text-sm shadow-[0_12px_30px_rgba(47,52,55,0.055)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#247f88]">Workspace du dossier</p>
              {item.workspace ? (
                <p className="mt-1 font-semibold text-[#2f3437]">
                  {item.workspace.name} <span className="font-normal text-[#766f68]">({item.workspace.slug})</span>
                </p>
              ) : (
                <p className="mt-1 font-semibold text-[#766f68]">Aucun Workspace rattache.</p>
              )}
              <p className="mt-1 text-xs text-[#766f68]">
                Ce rattachement organise le dossier existant sans modifier l'acces candidat, sans notification et sans nouveau lien.
              </p>
            </div>
            {workspaceOptions.length > 0 ? (
              <div className="flex flex-col gap-2">
                <form action={attachRelationCaseToWorkspaceAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input type="hidden" name="relationCaseId" value={item.id} />
                  <select
                    name="workspaceId"
                    required
                    defaultValue={item.workspace?.id ?? ""}
                    className="min-w-64 rounded-xl border border-[#d6e7e8] bg-white px-3 py-2 text-sm text-[#2f3437]"
                  >
                    <option value="">Choisir un Workspace</option>
                    {workspaceOptions.map((workspace) => (
                      <option key={workspace.id} value={workspace.id}>
                        {workspace.name} - {workspace.categoryLabel} - {workspace.kindLabel}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                    {item.workspace ? "Changer de Workspace" : "Rattacher au Workspace"}
                  </button>
                </form>
                {item.workspace ? (
                  <form action={detachRelationCaseFromWorkspaceAction} className="sm:self-end">
                    <input type="hidden" name="relationCaseId" value={item.id} />
                    <button type="submit" className="text-xs font-semibold text-slate-500 underline underline-offset-4">
                      Detacher du Workspace
                    </button>
                  </form>
                ) : null}
              </div>
            ) : (
              <p className="text-xs font-semibold text-[#766f68]">Aucun Workspace actif disponible.</p>
            )}
          </div>
        </section>
      ) : null}
      <nav className="mt-4 flex flex-wrap gap-2 rounded-2xl border bg-white p-3" aria-label="Actions de la relation">{["Conversation", "Documents", "Demandes", "Gouvernance", "Assistance IA"].map((label) => <span key={label} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">{label}</span>)}</nav>
      {debugMode && senderType === "OWNER" ? (
        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 shadow-sm">
          <p className="font-semibold uppercase tracking-wide text-amber-800">Debug</p>
          <div className="mt-3 space-y-1">
            {item.gLink.slug ? <p>Lien public candidat: /l/{item.gLink.slug}</p> : null}
            <p>Lien secure: /secure/{item.candidateAccessToken}</p>
          </div>
          <div className="mt-4">
            <DebugDeleteCaseButton caseId={item.id} />
          </div>
        </section>
      ) : null}
      <RelationCaseFields
        caseId={item.id}
        priority={item.priority}
        status={item.status}
        editable={senderType === "OWNER"}
      />
      <div className="mt-6">
        <RelationLiveKitMediaRoom
          caseId={item.id}
          actorKind={senderType === "OWNER" ? "owner" : "candidate"}
          candidateAccessToken={candidateAccessToken}
        />
      </div>
      <div className="mt-6">
        <RelationSecureMediaRoom
          caseId={item.id}
          role={senderType}
          candidateAccessToken={candidateAccessToken}
        />
      </div>
      <section className="mt-6 rounded-2xl border border-[#d6e7e8] bg-[#fffcf8] p-4 shadow-[0_12px_30px_rgba(47,52,55,0.055)]">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-[#2f3437]">Historique des communications</h2>
            <p className="text-xs text-[#766f68]">Sessions conservees sans enregistrement ni transcription automatique.</p>
          </div>
          <span className="rounded-full bg-[#e8f8f9] px-2.5 py-1 text-xs font-medium text-[#247f88]">
            {communicationSessions.length} session{communicationSessions.length > 1 ? "s" : ""}
          </span>
        </div>
        {communicationSessions.length === 0 ? (
          <p className="mt-3 rounded-xl bg-[#f6f0e8] px-3 py-2 text-sm text-[#766f68]">
            Aucune communication historisee pour ce dossier.
          </p>
        ) : (
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {communicationSessions.map((session) => {
              const isClosed = session.status === "COMPLETED" || session.status === "CANCELLED";
              const displayTitle = getCommunicationDisplayTitle(session);
              const displaySubtitle = getCommunicationDisplaySubtitle(session);

              return (
                <article key={session.id} className="rounded-xl border border-[#e7e0d6] bg-white p-3 text-xs">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[#2f3437]">{displayTitle}</p>
                      <p className="mt-0.5 text-[#766f68]">{displaySubtitle}</p>
                    </div>
                    <span className="rounded-full bg-[#f6f0e8] px-2 py-1 font-semibold text-[#2f3437]">
                      {getCommunicationDisplayStatus(session)}
                    </span>
                  </div>
                  <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div>
                      <dt className="font-medium text-[#766f68]">Creee le</dt>
                      <dd className="font-semibold text-[#2f3437]">{formatActivityDate(session.createdAt)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-[#766f68]">Terminee le</dt>
                      <dd className="font-semibold text-[#2f3437]">{isClosed ? formatActivityDate(session.updatedAt) : "Non terminee"}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-[#766f68]">Expiration</dt>
                      <dd className="font-semibold text-[#2f3437]">{getCommunicationExpirationDisplay(session)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-[#766f68]">Provider</dt>
                      <dd className="font-semibold text-[#2f3437]">{getCommunicationProviderDisplay(session)}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 rounded-lg bg-[#f6f0e8] px-2.5 py-2 font-medium text-[#766f68]">
                    Garanties : pas d'enregistrement, pas de transcription automatique.
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <div
        data-case-layout="conversation-ai-sidebar"
        className="mt-6 grid gap-5 lg:mt-8 xl:grid-cols-[minmax(420px,1.2fr)_minmax(390px,0.98fr)_280px] xl:gap-5"
      >
        <section data-conversation-zone="true" className="min-w-0 space-y-4">
          <ChatBox
            caseId={candidateAccessToken ? undefined : item.id}
            candidateAccessToken={candidateAccessToken}
            candidateDisplayName={candidateIdentityState.displayName}
            candidateContactLabel={candidateIdentityState.displayEmail}
            candidateIdentityStatus={candidateIdentityState.status}
            readOnly={!relationWritable}
            readOnlyReason={governanceBlockedMessage}
            senderType={senderType}
          />
          <div className="rounded-2xl border border-[#d6e7e8] bg-[#fffcf8] p-4 shadow-[0_12px_30px_rgba(47,52,55,0.055)] transition hover:shadow-[0_18px_40px_rgba(47,52,55,0.08)]">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-[#2f3437]">Documents</h2>
                <p className="text-xs text-[#766f68]">Pieces partagees dans le meme contexte que la conversation.</p>
              </div>
              <span className="rounded-full bg-[#e8f8f9] px-2.5 py-1 text-xs font-medium text-[#247f88]">
                {item.documents.length} document{item.documents.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="mt-3">
              <DocumentList
                documents={item.documents}
                caseId={candidateAccessToken ? undefined : item.id}
                candidateAccessToken={candidateAccessToken}
              />
            </div>
          </div>
          <DocumentUpload
            caseId={candidateAccessToken ? undefined : item.id}
            candidateAccessToken={candidateAccessToken}
            disabled={!relationWritable}
            disabledReason={governanceBlockedMessage}
          />
        </section>
        {senderType === "OWNER" ? (
          <AIWorkspace caseId={item.id} matchingEnabled={item.matchingEnabled} situation={dossierSituation} debugMode={debugMode} />
        ) : null}
        <aside data-metadata-sidebar="true" className="min-w-0 space-y-4 xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)] xl:overflow-y-auto xl:pr-1">
          <details className="group rounded-2xl border border-[#d6e7e8] bg-[#fffcf8] p-4 shadow-[0_12px_30px_rgba(47,52,55,0.055)]" open>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-[#2f3437] focus:outline-none focus:ring-2 focus:ring-[#2fb8c4]/30">
              Identité candidat
              <span className="text-xs font-medium text-[#247f88] transition group-open:rotate-180">v</span>
            </summary>
            <div className="mt-3 space-y-2 text-xs">
              <div className="rounded-lg bg-[#f6f0e8] px-3 py-2">
                <p className="font-medium text-[#766f68]">Candidat</p>
                <p className="mt-0.5 font-semibold text-[#2f3437]">{candidateIdentityState.displayName}</p>
              </div>
              <div className="rounded-lg bg-[#f6f0e8] px-3 py-2">
                <p className="font-medium text-[#766f68]">Contact</p>
                <p className="mt-0.5 font-semibold text-[#2f3437]">{candidateIdentityState.displayEmail}</p>
              </div>
              <div className="rounded-lg bg-[#f6f0e8] px-3 py-2">
                <p className="font-medium text-[#766f68]">Statut identité</p>
                <p className="mt-0.5 font-semibold text-[#2f3437]">{candidateIdentityState.status}</p>
              </div>
              {candidateIdentityState.recommendation ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 font-medium text-amber-900 ring-1 ring-amber-200">
                  {candidateIdentityState.recommendation}
                </p>
              ) : null}
            </div>
          </details>
          <details className="group rounded-2xl border border-[#d6e7e8] bg-[#fffcf8] p-4 shadow-[0_12px_30px_rgba(47,52,55,0.055)]" open>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-[#2f3437] focus:outline-none focus:ring-2 focus:ring-[#2fb8c4]/30">
              Matching
              <span className="text-xs font-medium text-[#247f88] transition group-open:rotate-180">v</span>
            </summary>
            <div className="mt-3">
              <MatchingOptInPanel
                caseId={item.id}
                initialMatchingEnabled={item.matchingEnabled}
                candidateAccessToken={candidateAccessToken}
                disabled={isCandidateView && !relationWritable}
                disabledReason={governanceBlockedMessage}
                senderType={senderType}
              />
            </div>
          </details>
          {senderType === "OWNER" ? (
            <RelationGovernanceControls
              caseId={item.id}
              status={item.governanceStatus}
              reason={item.governanceReason}
            />
          ) : null}
          {senderType === "OWNER" ? (
            <details className="group rounded-2xl border border-[#d6e7e8] bg-[#fffcf8] p-4 shadow-[0_12px_30px_rgba(47,52,55,0.055)]" open>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-[#2f3437] focus:outline-none focus:ring-2 focus:ring-[#2fb8c4]/30">
                Confiance
                <span className="text-xs font-medium text-[#247f88] transition group-open:rotate-180">v</span>
              </summary>
              <div className="mt-3 space-y-2 text-xs">
                {!item.candidateIdentity ? (
                  <p className="rounded-lg bg-[#f6f0e8] px-3 py-2 text-[#766f68]">
                    Identite candidat non rattachee
                  </p>
                ) : (
                  <>
                    <div className="rounded-lg bg-[#f6f0e8] px-3 py-2">
                      <p className="font-medium text-[#766f68]">Statut identite</p>
                      <p className="mt-0.5 font-semibold text-[#2f3437]">{item.candidateIdentity.status}</p>
                    </div>
                    <div className="rounded-lg bg-[#f6f0e8] px-3 py-2">
                      <p className="font-medium text-[#766f68]">Credentials actifs</p>
                      <p className="mt-0.5 font-semibold text-[#2f3437]">
                        {getActiveCredentialCountLabel(item.candidateIdentity.credentials.length)}
                      </p>
                      <div className="mt-2 space-y-2">
                        {item.candidateIdentity.credentials.length === 0 ? (
                          <p className="rounded-lg bg-[#fffcf8] px-2.5 py-2 text-[#766f68]">
                            Aucun credential actif
                          </p>
                        ) : (
                          item.candidateIdentity.credentials.map((credential) => {
                            const kind = getCredentialKindLabel(credential);

                            return (
                              <div key={credential.id} className="rounded-lg bg-[#fffcf8] px-2.5 py-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={
                                      kind === "Lifecycle"
                                        ? "rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 ring-1 ring-slate-200"
                                        : "rounded-full bg-[#e8f8f9] px-2 py-0.5 text-[10px] font-semibold text-[#247f88] ring-1 ring-[#d6e7e8]"
                                    }
                                  >
                                    {kind}
                                  </span>
                                  <span className="break-all font-semibold text-[#2f3437]">
                                    {credential.credentialType.code}
                                  </span>
                                </div>
                                <p className="mt-1 text-[#766f68]">
                                  Emetteur : {credential.issuerTrustedOrganization.organizationId}
                                </p>
                                <p className="mt-0.5 text-[#766f68]">
                                  Emis le : {formatActivityDate(credential.issuedAt)}
                                </p>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                    {debugMode ? (
                      <p className="break-all rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                        Identity ID: {item.candidateIdentity.id}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            </details>
          ) : null}
          <RelationActionsPanel
            caseId={item.id}
            actions={item.relationActions}
            editable={senderType === "OWNER"}
            identityRequestRecommended={candidateIdentityState.isMissingIdentity}
            candidateAccessToken={candidateAccessToken}
            disabled={!relationWritable}
            disabledReason={governanceBlockedMessage}
          />
          {senderType === "OWNER" ? (
            <details className="group rounded-2xl border border-[#d6e7e8] bg-[#fffcf8] p-4 shadow-[0_12px_30px_rgba(47,52,55,0.055)]" open>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-[#2f3437] focus:outline-none focus:ring-2 focus:ring-[#2fb8c4]/30">
                Réponses candidat
                <span className="text-xs font-medium text-[#247f88] transition group-open:rotate-180">v</span>
              </summary>
              <div className="mt-3 space-y-3">
                <div className="rounded-xl border border-[#e7e0d6] bg-white px-3 py-2 text-xs">
                  <p className="font-medium text-[#766f68]">Statut identité</p>
                  <p className="mt-0.5 font-semibold text-[#2f3437]">{candidateIdentityState.status}</p>
                  <p className="mt-1 text-[#766f68]">
                    {candidateIdentityState.displayName} · {candidateIdentityState.displayEmail}
                  </p>
                </div>
                {formSubmissions.length === 0 ? (
                  <p className="rounded-lg bg-[#f6f0e8] px-3 py-2 text-xs text-[#766f68]">
                    Aucune réponse de formulaire enregistrée.
                  </p>
                ) : (
                  formSubmissions.map((submission) => {
                    const entries = getSubmissionAnswerEntries(submission);

                    return (
                      <div key={submission.id} className="rounded-xl bg-[#f6f0e8] p-3 text-xs">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-[#2f3437]">{submission.formTemplate.name}</p>
                          <span className="text-[11px] text-[#766f68]">{formatActivityDate(submission.createdAt)}</span>
                        </div>
                        {entries.length === 0 ? (
                          <p className="text-[#766f68]">Aucune réponse exploitable.</p>
                        ) : (
                          <dl className="space-y-2">
                            {entries.map((entry) => (
                              <div key={entry.key} className="border-t border-[#e6ded3] pt-2 first:border-t-0 first:pt-0">
                                <dt className="font-medium text-[#766f68]">{entry.label}</dt>
                                <dd className="mt-0.5 whitespace-pre-wrap break-words text-[#2f3437]">
                                  {formatSubmissionAnswer(entry.value)}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </details>
          ) : null}
          {senderType === "OWNER" ? (
            <details className="group rounded-2xl border border-[#d6e7e8] bg-[#fffcf8] p-4 shadow-[0_12px_30px_rgba(47,52,55,0.055)]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-[#2f3437] focus:outline-none focus:ring-2 focus:ring-[#2fb8c4]/30">
                Acces
                <span className="text-xs font-medium text-[#247f88] transition group-open:rotate-180">v</span>
              </summary>
              <div className="mt-3">
                <CandidateAccessControls
                  caseId={item.id}
                  candidateAccessToken={item.candidateAccessToken}
                  candidateAccessExpiresAt={item.candidateAccessExpiresAt}
                  candidateAccessRevokedAt={item.candidateAccessRevokedAt}
                />
              </div>
            </details>
          ) : null}
          <details className="group rounded-2xl border border-[#d6e7e8] bg-[#fffcf8] p-4 shadow-[0_12px_30px_rgba(47,52,55,0.055)]" open>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-[#2f3437] focus:outline-none focus:ring-2 focus:ring-[#2fb8c4]/30">
              Chronologie
              <span className="text-xs font-medium text-[#247f88] transition group-open:rotate-180">v</span>
            </summary>
            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
              {activityEvents.slice(0, 16).map((event) => (
                <div key={event.id} className="rounded-lg bg-[#f6f0e8] px-2.5 py-2 text-xs transition hover:bg-[#e8f8f9]">
                  <p className="font-medium leading-snug text-[#2f3437]">{event.label}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-[#766f68]">
                    <span>{event.type}</span>
                    {"badge" in event && event.badge ? <span>{event.badge}</span> : null}
                    {"status" in event && event.status ? <span>{event.status}</span> : null}
                  </div>
                  <p className="mt-1 text-[11px] text-[#766f68]">{formatRelativeActivityDate(event.date)}</p>
                </div>
              ))}
            </div>
          </details>
          <div className={isCandidateView ? "hidden lg:block" : ""}>
            <details className="group rounded-2xl border border-[#d6e7e8] bg-[#fffcf8] p-4 shadow-[0_12px_30px_rgba(47,52,55,0.055)]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-[#2f3437] focus:outline-none focus:ring-2 focus:ring-[#2fb8c4]/30">
                Audit
                <span className="text-xs font-medium text-[#247f88] transition group-open:rotate-180">v</span>
              </summary>
              <div className="mt-3 max-h-[40vh] space-y-2 overflow-y-auto pr-2 lg:max-h-80">
                {governanceAuditLogs.length === 0 ? (
                  <p className="rounded-xl bg-[#f6f0e8] p-3 text-xs text-[#766f68]">
                    Aucun evenement de gouvernance a afficher.
                  </p>
                ) : null}
                {governanceAuditLogs.map((log) => (
                  <div key={log.id} className="rounded-xl bg-[#f6f0e8] p-2 text-xs">
                    <p className="font-medium text-[#2f3437]">{humanizeAIEvent(log.eventType).title}</p>
                    <p className="text-[#766f68]">
                      {formatActivityDate(log.createdAt)}
                    </p>
                    {debugMode && senderType === "OWNER" ? (
                      <p className="mt-1 break-all font-mono text-[10px] text-amber-900">
                        Code audit: {log.eventType}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </details>
          </div>
        </aside>
      </div>
    </main>
  );
}
