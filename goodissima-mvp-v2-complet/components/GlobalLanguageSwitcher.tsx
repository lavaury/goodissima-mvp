"use client";

import { usePathname, useSelectedLayoutSegment } from "next/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export function GlobalLanguageSwitcher() {
  const pathname = usePathname();
  const segment = useSelectedLayoutSegment();
  // ConnectedShell renders the same language control inline in its header.
  if (pathname === "/" || segment === "(connected)") return null;

  return (
    <div className="fixed right-4 top-4 z-40 sm:right-6 sm:top-6">
      <LanguageSwitcher compact />
    </div>
  );
}
