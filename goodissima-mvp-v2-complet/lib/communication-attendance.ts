import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AttendanceActorKind = "owner" | "candidate" | "guest";
type MediaKind = "audio" | "video" | "screen";
export type AttendanceEntry = { participantKey: string; displayName: string; roleLabel: string; accessKind: string; actorKind: AttendanceActorKind; joinedAt: string; leftAt: string | null; mediaUsed: Record<MediaKind, boolean> };

function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
export function attendanceFromMetadata(value: unknown): AttendanceEntry[] {
  const attendance = record(value).attendance;
  if (!Array.isArray(attendance)) return [];
  return attendance.filter((item): item is AttendanceEntry => Boolean(record(item).participantKey));
}

export async function updateCommunicationAttendance(input: { sessionId: string; participantKey: string; displayName: string; roleLabel: string; accessKind: string; actorKind: AttendanceActorKind; event: "join" | "leave" | "media"; media?: MediaKind }) {
  const session = await prisma.communicationSession.findUnique({ where: { id: input.sessionId }, select: { metadata: true } });
  if (!session) return null;
  const metadata = record(session.metadata); const attendance = attendanceFromMetadata(metadata); const now = new Date().toISOString();
  const index = attendance.findIndex((entry) => entry.participantKey === input.participantKey);
  const previous = index >= 0 ? attendance[index] : null;
  const entry: AttendanceEntry = {
    participantKey: input.participantKey, displayName: input.displayName, roleLabel: input.roleLabel, accessKind: input.accessKind, actorKind: input.actorKind,
    joinedAt: input.event === "join" ? now : previous?.joinedAt ?? now,
    leftAt: input.event === "leave" ? now : input.event === "join" ? null : previous?.leftAt ?? null,
    mediaUsed: { audio: previous?.mediaUsed?.audio ?? false, video: previous?.mediaUsed?.video ?? false, screen: previous?.mediaUsed?.screen ?? false },
  };
  if (input.media) entry.mediaUsed[input.media] = true;
  const next = index >= 0 ? attendance.map((item, itemIndex) => itemIndex === index ? entry : item) : [...attendance, entry];
  return prisma.communicationSession.update({ where: { id: input.sessionId }, data: { metadata: { ...metadata, attendance: next } as Prisma.InputJsonObject } });
}
