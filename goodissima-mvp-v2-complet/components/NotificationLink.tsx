"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export function NotificationLink({ notificationId, href, children, className = "", onRead, onNavigate }: { notificationId: string; href: string; children: ReactNode; className?: string; onRead?: () => void; onNavigate?: () => void }) {
  const router = useRouter();
  async function open() {
    let didRead = false;
    try {
      const response = await fetch(`/api/notifications/${encodeURIComponent(notificationId)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ read: true }),
      });
      if (response.ok) {
        didRead = true;
        onRead?.();
        window.dispatchEvent(new CustomEvent("goodissima:notification-read", { detail: { notificationId } }));
      }
    } finally {
      onNavigate?.();
      router.push(href);
      if (didRead) router.refresh();
    }
  }
  return <button type="button" onClick={() => void open()} className={className}>{children}</button>;
}
