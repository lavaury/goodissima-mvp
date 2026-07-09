import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type { CommunicationChannelType } from "@prisma/client";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const channelTypes = new Set<CommunicationChannelType>(["VOICE_IP", "VIDEO_IP", "SCREEN_SHARE"]);

const channelTitles: Record<CommunicationChannelType, string> = {
  VOICE_IP: "Appel audio relationnel",
  VIDEO_IP: "Visio relationnelle",
  SCREEN_SHARE: "Partage d'ecran relationnel",
};

function normalizeBody(value: unknown): { channelType?: unknown } {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function serializeSession(session: {
  id: string;
  workspaceId: string | null;
  relationCaseId: string | null;
  channelType: CommunicationChannelType;
  provider: string;
  status: string;
  title: string;
  recordingEnabled: boolean;
  transcriptionRequested: boolean;
  transcriptionConsented: boolean;
  automaticNotificationSent: boolean;
  tokenGenerated: boolean;
  accessOpened: boolean;
  workflowStarted: boolean;
}) {
  return {
    id: session.id,
    workspaceId: session.workspaceId,
    relationCaseId: session.relationCaseId,
    channelType: session.channelType,
    provider: session.provider,
    status: session.status,
    title: session.title,
    recordingEnabled: session.recordingEnabled,
    transcriptionRequested: session.transcriptionRequested,
    transcriptionConsented: session.transcriptionConsented,
    automaticNotificationSent: session.automaticNotificationSent,
    tokenGenerated: session.tokenGenerated,
    accessOpened: session.accessOpened,
    workflowStarted: session.workflowStarted,
  };
}

export async function POST(req: Request, { params }: { params: { caseId: string } }) {
  try {
    const owner = await getCurrentPrismaUser();
    const body = normalizeBody(await req.json().catch(() => ({})));
    const channelType = typeof body.channelType === "string" ? body.channelType : "";

    if (!channelTypes.has(channelType as CommunicationChannelType)) {
      return NextResponse.json({ error: "Type de communication invalide." }, { status: 400 });
    }

    const relationCase = await prisma.relationCase.findFirst({
      where: {
        id: params.caseId,
        ownerId: owner.id,
      },
      select: {
        id: true,
        ownerId: true,
        workspaceId: true,
        templateId: true,
        gLink: {
          select: {
            workspaceId: true,
          },
        },
      },
    });

    if (!relationCase) {
      return NextResponse.json({ error: "Relation introuvable pour cet utilisateur." }, { status: 404 });
    }

    const typedChannelType = channelType as CommunicationChannelType;
    const workspaceId = relationCase.workspaceId ?? relationCase.gLink?.workspaceId ?? null;

    const existingSession = await prisma.communicationSession.findFirst({
      where: {
        ownerId: owner.id,
        relationCaseId: relationCase.id,
        channelType: typedChannelType,
        status: "PREPARED_NOT_STARTED",
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    const session = existingSession
      ? await prisma.communicationSession.update({
          where: {
            id: existingSession.id,
          },
          data: {
            workspaceId,
            relationTemplateId: relationCase.templateId,
            recordingEnabled: false,
            transcriptionRequested: false,
            transcriptionConsented: false,
            automaticNotificationSent: false,
            tokenGenerated: false,
            accessOpened: false,
            workflowStarted: false,
          },
        })
      : await prisma.communicationSession.create({
        data: {
          ownerId: owner.id,
          workspaceId,
          relationTemplateId: relationCase.templateId,
          relationCaseId: relationCase.id,
          channelType: typedChannelType,
          provider: "NONE",
          status: "PREPARED_NOT_STARTED",
          title: channelTitles[typedChannelType],
          purpose: "Session relationnelle locale preparee depuis le dossier.",
          note: "V1 navigateur local : aucun provider distant, aucun token public, aucun email, aucune notification.",
          transcriptionRequested: false,
          transcriptionConsented: false,
          recordingEnabled: false,
          automaticNotificationSent: false,
          tokenGenerated: false,
          accessOpened: false,
          workflowStarted: false,
        },
      });

    revalidatePath(`/cases/${params.caseId}`);
    revalidatePath("/gouvernance");

    return NextResponse.json({ session: serializeSession(session) });
  } catch (error) {
    console.error("[relation-media] protected-call failed", error);
    return NextResponse.json({ error: "Impossible de preparer la communication relationnelle." }, { status: 500 });
  }
}
