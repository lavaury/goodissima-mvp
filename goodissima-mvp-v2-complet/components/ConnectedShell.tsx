import Image from "next/image";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { PlatformNavigation } from "@/components/PlatformNavigation";
import { ContextualBoussole } from "@/components/ContextualBoussole";
import { SpatialNavigationProvider } from "@/components/SpatialNavigationContext";
import { SpatialNavigationBar } from "@/components/SpatialNavigationBar";

export function ConnectedShell({ children, organizationName }: {
  children: ReactNode;
  organizationName?: string | null;
}) {
  return (
    <SpatialNavigationProvider>
    <div data-connected-shell="true" className="min-h-screen min-w-0 pb-20">
      <header className="relative mx-auto grid max-w-[92rem] grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 border-b bg-white px-4 py-2 sm:px-6 lg:grid-cols-[auto_1fr_auto]">
          <Link href="/dashboard" aria-label="Goodissima — Accueil" data-boussole-id="open-dashboard" className="flex w-fit items-center gap-1 rounded-lg text-xs font-semibold text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-700">
            <span className="relative block h-11 w-16 overflow-hidden sm:w-24"><Image src="/logo-goodissima.png" alt="Goodissima" width={2048} height={1365} priority className="absolute left-0 top-1/2 h-auto w-full -translate-y-1/2" /></span>
            <span>Accueil</span>
          </Link>
        <PlatformNavigation organizationName={organizationName} />
      </header>
      <SpatialNavigationBar />
      {/* Each page keeps its own main landmark, title and business actions. */}
      <div data-connected-content="true" className="min-w-0">{children}</div>
      <Suspense fallback={null}><ContextualBoussole /></Suspense>
    </div>
    </SpatialNavigationProvider>
  );
}
