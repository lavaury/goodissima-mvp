import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type { CommunicationChannelType } from "@prisma/client";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canWriteInRelation, getRelationGovernanceBlockedMessage } from "@/lib/relation-governance";
import {
  getOrCreateRelationMediaSession,
  relationMediaChannelTypes,
  serializeRelationMediaSession,
} from "@/lib/relation-media-sessions";

function normalizeBody(value: unknown): { channelType?: unknown } {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export async function POST(req: Request, { params }: { params: { caseId: string } }) {
  try {
    const owner = await getCurrentPrismaUser();
    const body = normalizeBody(await req.json().catch(() => ({})));
    const channelType = typeof body.channelType === "string" ? body.channelType : "";

    if (!relationMediaChannelTypes.has(channelType as CommunicationChannelType)) {
      return NextResponse.json({ error: "Type de communication invalide." }, { status: 400 });
    }

    const relationCase = await prisma.relationCase.findFirst({
      where: {
        id: params.caseId,
        ownerId: owner.id,
      },
      select: {
        id: true,
        workspaceId: true,
        templateId: true,
        governanceStatus: true,
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
    if (!canWriteInRelation(relationCase.governanceStatus)) return NextResponse.json({ error: getRelationGovernanceBlockedMessage(relationCase.governanceStatus) }, { status: 409 });

    const typedChannelType = channelType as CommunicationChannelType;
    const workspaceId = relationCase.workspaceId ?? relationCase.gLink?.workspaceId ?? null;
    const session = await getOrCreateRelationMediaSession({
      ownerId: owner.id,
      relationCaseId: relationCase.id,
      relationTemplateId: relationCase.templateId,
      workspaceId,
      channelType: typedChannelType,
    });

    revalidatePath(`/cases/${params.caseId}`);
    revalidatePath("/gouvernance");

    return NextResponse.json({
      session: serializeRelationMediaSession(relationCase.id, session),
      signaling: {
        peerId: `owner:${owner.id}`,
        role: "OWNER",
      },
    });
  } catch (error) {
    console.error("[relation-media] owner protected-call failed", error);
    return NextResponse.json({ error: "Impossible de preparer la communication relationnelle." }, { status: 500 });
  }
}
