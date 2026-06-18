export type AnnouncementStatus = "ACTIVE" | "DISABLED" | "EXPIRED" | "ARCHIVED";
export type AnnouncementListView = "active" | "archived";

export function announcementStatusLabel(status: AnnouncementStatus) {
  if (status === "ACTIVE") return "Publiée";
  if (status === "DISABLED") return "Suspendue";
  if (status === "EXPIRED") return "Clôturée";
  return "Archivée";
}

export function announcementListView(value: unknown): AnnouncementListView {
  return value === "archived" ? "archived" : "active";
}

export function announcementBelongsToView(
  status: AnnouncementStatus,
  view: AnnouncementListView,
) {
  return view === "archived" ? status === "ARCHIVED" : status !== "ARCHIVED";
}
