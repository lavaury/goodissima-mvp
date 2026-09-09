"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { ActiveOrganizationBadge } from "@/components/ActiveOrganizationBadge";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LogoutButton } from "@/components/LogoutButton";

const items = [
  { label: "Boussole", href: "/boussole/decouverte", icon: "🧭" },
  { label: "Annuaire", href: "/annuaire", icon: "🌍" },
  { label: "Mes espaces", href: "/gouvernance", icon: "🗂" },
];

const userItems = [{ label: "Mon profil", href: "/identity" }];
const accountItems = [
  { label: "IA & Valeur", href: "/ia-valeur" },
  { label: "Administration", href: "/administration" },
];

const boussoleIds: Record<string, string> = {
  "/links/simple": "create-simple-link",
  "/gouvernance": "open-governance",
  "/gouvernance/pilotage": "open-governance-pilotage",
  "/gouvernance/portfolios": "open-portfolios",
  "/gouvernance/nouveau": "create-governed-journey",
  "/annuaire": "open-directory",
  "/settings": "open-settings",
  "/opportunities": "open-opportunities",
  "/parcours": "open-journeys",
  "/relations": "open-relations",
  "/ia-valeur": "open-ai-value",
  "/boussole/decouverte": "open-boussole-from-navigation",
};

const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700";

export function PlatformNavigation({ organizationName, aiValueAllowed = false }: { organizationName?: string | null; aiValueAllowed?: boolean }) {
  const pathname = usePathname();
  const userMenu = useRef<HTMLDetailsElement>(null);
  const matches = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const resolvedActiveHref = matches("/boussole") ? "/boussole/decouverte"
    : matches("/annuaire") ? "/annuaire"
      : ["/gouvernance", "/links", "/opportunities", "/parcours", "/templates", "/relations", "/cases"].some(matches) ? "/gouvernance" : undefined;

  function closeMenu(restoreFocus = false) {
    const menu = userMenu.current;
    if (!menu?.open) return;
    menu.querySelectorAll("details[open]").forEach(details => details.removeAttribute("open"));
    menu.open = false;
    if (restoreFocus) menu.querySelector("summary")?.focus();
  }

  useEffect(() => { closeMenu(); }, [pathname]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !userMenu.current?.contains(event.target)) closeMenu();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") closeMenu(true); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, []);

  return (
    <div className="contents">
      <nav data-boussole-id={pathname === "/dashboard" ? "dashboard-menu" : undefined} aria-label="Navigation principale" data-boussole-navigation="global" className="order-last col-span-2 grid min-w-0 grid-cols-3 gap-1 lg:order-none lg:col-span-1 lg:mx-auto lg:w-full lg:max-w-lg">
        {items.map(item => (
          <Link key={item.href} href={item.href} data-boussole-id={boussoleIds[item.href]}
            aria-current={item.href === resolvedActiveHref ? (pathname === item.href ? "page" : "location") : undefined}
            className={`flex min-h-11 items-center justify-center gap-1 rounded-xl text-xs sm:gap-2 sm:px-3 sm:text-sm ${focus} ${item.href === resolvedActiveHref ? "bg-slate-900 font-bold text-white underline underline-offset-4" : "font-medium text-slate-700 hover:bg-slate-100"}`}>
            <span aria-hidden="true">{item.icon}</span><span className="whitespace-nowrap">{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="flex min-w-0 items-center justify-self-end gap-1">
        {[{ href: "/favoris", label: "Favoris", icon: "⭐" }, { href: "/recherche", label: "Recherche Goodissima", icon: "🔎" }].map(item =>
          <Link key={item.href} href={item.href} aria-label={item.label} title={item.label} aria-current={matches(item.href) ? "page" : undefined}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg hover:bg-slate-100 ${focus}`}>
            <span aria-hidden="true">{item.icon}</span>
          </Link>)}
      <details ref={userMenu} data-boussole-disclosure="navigation" className="justify-self-end">
        <summary className={`flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border bg-white px-3 text-sm font-semibold text-slate-800 ${focus} [&::-webkit-details-marker]:hidden`}>
          <span aria-hidden="true">👤</span><span className="sr-only sm:not-sr-only">Utilisateur</span><span aria-hidden="true">▾</span>
        </summary>
        <div aria-label="Compte" data-boussole-navigation="global" className="absolute right-4 top-[calc(100%-0.25rem)] z-40 max-h-[min(70dvh,36rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border bg-white p-3 shadow-xl sm:right-6">
          <ActiveOrganizationBadge organizationName={organizationName} className="mb-3" />
          <ul className="space-y-1">
            {userItems.map(item => <li key={item.href}><Link href={item.href} data-boussole-id={boussoleIds[item.href]} aria-current={matches(item.href) ? "page" : undefined} onClick={() => closeMenu()} className={`block rounded-lg px-3 py-2 text-sm ${focus} ${matches(item.href) ? "font-bold underline" : "hover:bg-slate-100"}`}>{item.label}</Link></li>)}
          </ul>
          <div className="my-3"><LanguageSwitcher /></div>
          <ul className="space-y-1 border-t pt-2">
            {accountItems.filter(item => item.href !== "/ia-valeur" || aiValueAllowed).map(item => <li key={item.href}>
              <Link href={item.href} data-boussole-id={boussoleIds[item.href]} onClick={() => closeMenu()}
                className={`block rounded-lg px-3 py-2 text-sm hover:bg-slate-100 ${focus}`}>{item.label}</Link>
            </li>)}
          </ul>
          <div className="mt-3"><LogoutButton compact /></div>
        </div>
      </details>
      </div>
    </div>
  );
}
