import { NotificationLink } from "@/components/NotificationLink";

const style = "inline-flex min-h-7 shrink-0 items-center rounded-full border border-cyan-700 bg-cyan-50 px-2 text-xs font-bold text-cyan-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700";

export function AttentionCount({ count }: { count: number }) {
  return count > 0 ? <span aria-label={`${count} notification${count > 1 ? "s" : ""} non lue${count > 1 ? "s" : ""}`} className={style}>● {count}</span> : null;
}

export function NotificationAttentionBadge({ notificationId, href, count, isNew }: { notificationId: string; href: string; count: number; isNew: boolean }) {
  return <NotificationLink notificationId={notificationId} href={href} className={style}><span aria-hidden="true">● </span>{isNew ? "Nouveau · " : "Non lu · "}{count}</NotificationLink>;
}
