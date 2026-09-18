export type JourneyMeetingSummary = {
  id: string;
  status: string;
  accessOpened: boolean;
  scheduledAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function meetingIsClosed(meeting: JourneyMeetingSummary, now = new Date()) {
  return meeting.status === "COMPLETED" || meeting.status === "CANCELLED" || Boolean(meeting.expiresAt && meeting.expiresAt <= now);
}

export function canScheduleGovernedMeeting(meeting: Pick<JourneyMeetingSummary, "status" | "scheduledAt">) {
  return meeting.status === "PREPARED_NOT_STARTED" && meeting.scheduledAt === null;
}

export function meetingListCategory(meeting: JourneyMeetingSummary, now = new Date()): "En préparation" | "À venir" | "Terminées" {
  if (meetingIsClosed(meeting, now)) return "Terminées";
  if (meeting.accessOpened || Boolean(meeting.scheduledAt && meeting.scheduledAt > now)) return "À venir";
  return "En préparation";
}

export function selectPrimaryMeetings<T extends JourneyMeetingSummary>(meetings: T[], now = new Date()): T[] {
  const open = meetings.filter((meeting) => !meetingIsClosed(meeting, now));
  const current = open.filter((meeting) => meeting.accessOpened).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  const upcoming = open.filter((meeting) => meeting.id !== current?.id && meeting.scheduledAt && meeting.scheduledAt > now).sort((a, b) => a.scheduledAt!.getTime() - b.scheduledAt!.getTime())[0];
  const preparing = open.filter((meeting) => meeting.id !== current?.id && meeting.id !== upcoming?.id).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  const recent = meetings.filter((meeting) => meetingIsClosed(meeting, now)).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  return [current, upcoming, preparing, recent].filter((meeting, index, all): meeting is T => Boolean(meeting) && all.findIndex((item) => item?.id === meeting?.id) === index).slice(0, 3);
}
