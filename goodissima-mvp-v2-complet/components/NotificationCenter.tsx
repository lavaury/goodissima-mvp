"use client";

import { useEffect, useRef, useState } from "react";
import { NotificationLink } from "@/components/NotificationLink";
import type { NotificationView } from "@/lib/notification-projection";

type Payload = { notifications: NotificationView[]; unreadCount: number };
const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700";

export function NotificationCenter() {
  const [data, setData] = useState<Payload>({ notifications: [], unreadCount: 0 });
  const [pulse, setPulse] = useState(false);
  const previousCount = useRef(0);
  const disclosure = useRef<HTMLDetailsElement>(null);
  async function load() {
    try {
      const response = await fetch("/api/notifications?limit=10", { cache: "no-store" });
      if (!response.ok) return;
      const next = await response.json() as Payload;
      if (next.unreadCount > previousCount.current) { setPulse(true); window.setTimeout(() => setPulse(false), 700); }
      previousCount.current = next.unreadCount;
      setData(next);
    } catch {
      // Keep the last truthful state until the next lightweight poll.
    }
  }
  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 45_000);
    return () => window.clearInterval(interval);
  }, []);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && disclosure.current?.open && !disclosure.current.contains(event.target)) disclosure.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && disclosure.current?.open) {
        disclosure.current.open = false;
        disclosure.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, []);
  const label = data.unreadCount ? `Notifications, ${data.unreadCount} non lue${data.unreadCount > 1 ? "s" : ""}` : "Notifications, aucune non lue";
  return <details ref={disclosure} className="relative shrink-0">
    <summary aria-label={label} title="Notifications" className={`relative flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-xl text-lg hover:bg-slate-100 ${focus} [&::-webkit-details-marker]:hidden`}>
      <span aria-hidden="true" className={pulse ? "motion-safe:animate-bounce" : undefined}>🔔</span>
      {data.unreadCount > 0 ? <span aria-label={`${data.unreadCount} non lues`} className="absolute right-0 top-0 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-slate-900 px-1 text-[10px] font-bold text-white">{data.unreadCount > 9 ? "9+" : data.unreadCount}</span> : null}
    </summary>
    <section aria-label="Notifications récentes" className="absolute right-0 top-[calc(100%+0.25rem)] z-50 max-h-[min(70dvh,32rem)] w-[min(22rem,calc(100vw-1rem))] overflow-y-auto rounded-2xl border bg-white p-3 shadow-xl">
      <h2 className="font-bold">Notifications</h2>
      {!data.notifications.length ? <p className="mt-3 text-sm text-slate-600" role="status">Aucune notification récente.</p> : <ul className="mt-2 divide-y">{data.notifications.slice(0, 10).map(item => <li key={item.id} className="py-3">
        <p className={item.readAt ? "text-sm font-semibold" : "text-sm font-bold"}>{item.title}{!item.readAt ? <span className="sr-only"> — non lue</span> : null}</p>
        <p className="mt-1 break-words text-sm text-slate-700">{item.contextLabel}</p>
        <p className="mt-1 text-xs text-slate-500">{item.description} · <time dateTime={String(item.createdAt)}>{new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(item.createdAt))}</time></p>
        <NotificationLink notificationId={item.id} href={item.href} onNavigate={() => { if (disclosure.current) disclosure.current.open = false; }} onRead={() => setData(current => ({ ...current, unreadCount: Math.max(0, current.unreadCount - (item.readAt ? 0 : 1)), notifications: current.notifications.map(value => value.id === item.id ? { ...value, readAt: new Date() } : value) }))} className={`mt-2 min-h-11 rounded-lg border px-3 text-sm font-semibold ${focus}`}>Ouvrir le Dossier</NotificationLink>
      </li>)}</ul>}
    </section>
  </details>;
}
