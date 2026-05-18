import { NextResponse } from "next/server";
import { RelationPriority, RelationStatus } from "@prisma/client";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const relationPriorities = new Set<string>(Object.values(RelationPriority));
const relationStatuses = new Set<string>(Object.values(RelationStatus));

export async function PATCH(req: Request, { params }: { params: { caseId: string } }) {
  try {
    const owner = await getCurrentPrismaUser();
    const body = await req.json();
    const data: { priority?: RelationPriority; status?: RelationStatus } = {};

    if (body.priority !== undefined) {
      if (typeof body.priority !== "string" || !relationPriorities.has(body.priority)) {
        return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
      }

      data.priority = body.priority as RelationPriority;
    }

    if (body.status !== undefined) {
      if (typeof body.status !== "string" || !relationStatuses.has(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }

      data.status = body.status as RelationStatus;
    }

    if (!data.priority && !data.status) {
      return NextResponse.json({ error: "No changes provided" }, { status: 400 });
    }

    const relationCase = await prisma.relationCase.findFirst({
      where: { id: params.caseId, ownerId: owner.id },
      select: { id: true },
    });

    if (!relationCase) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const updated = await prisma.relationCase.update({
      where: { id: relationCase.id },
      data,
      select: {
        id: true,
        priority: true,
        status: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to update case" }, { status: 500 });
  }
}
