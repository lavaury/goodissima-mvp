"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export function NotificationLink({ notificationId, href, children, className = "", onRead, onNavigate }: { notificationId: string; href: string; children: ReactNode; className?: string; onRead?: () => void; onNavigate?: () => void }) {
  const router = useRouter();
  async function open() {
    try {
      const response = await fetch(`/api/notifications/${encodeURIComponent(notificationId)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ read: true }),
      });
      if (response.ok) onRead?.();
    } finally {
      onNavigate?.();
      router.push(href);
    }
  }
  return <button type="button" onClick={() => void open()} className={className}>{children}</button>;
}
