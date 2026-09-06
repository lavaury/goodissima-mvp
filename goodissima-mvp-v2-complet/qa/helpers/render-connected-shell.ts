import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTestModule } from "./load-test-module.ts";

export function shellModules(pathname: string, connected = true) {
  const navigation = { usePathname: () => pathname, useSelectedLayoutSegment: () => connected ? "(connected)" : pathname.split("/")[1] || null,
    useRouter: () => ({ refresh() {}, replace() {}, back() {}, forward() {} }) };
  const i18n = { useI18n: () => ({ locale: "fr", setLocale() {}, t: (key: string) => ({
    "language.label": "Langue", "language.fr": "FR", "language.en": "EN", "auth.logout": "Se déconnecter",
  } as Record<string, string>)[key] ?? key }) };
  const common = { react: React, "react/jsx-runtime": jsx, "next/navigation": navigation,
    "next/link": ({ children, prefetch: _prefetch, ...props }: any) => jsx.jsx("a", { ...props, children }),
    "next/image": ({ priority: _priority, ...props }: any) => jsx.jsx("img", props) };
  const badge = loadTestModule("components/ActiveOrganizationBadge.tsx", common);
  const language = loadTestModule("components/LanguageSwitcher.tsx", { ...common, "@/components/I18nProvider": i18n,
    "@/lib/i18n-core": { supportedLocales: ["fr", "en"] } });
  const logout = loadTestModule("components/LogoutButton.tsx", { ...common, "@/components/I18nProvider": i18n,
    "@/lib/supabase/client": { createClient: () => { throw new Error("No auth mutations in render tests"); } } });
  const platform = loadTestModule("components/PlatformNavigation.tsx", { ...common, "@/components/ActiveOrganizationBadge": badge,
    "@/components/LanguageSwitcher": language, "@/components/LogoutButton": logout });
  const spatial = loadTestModule("lib/spatial-navigation.ts", {});
  const history = loadTestModule("lib/connected-history.ts", {});
  const spatialContext = loadTestModule("components/SpatialNavigationContext.tsx", { ...common, "@/lib/spatial-navigation": spatial });
  const spatialBar = loadTestModule("components/SpatialNavigationBar.tsx", { ...common, "@/lib/spatial-navigation": spatial,
    "@/lib/connected-history": history, "@/components/SpatialNavigationContext": spatialContext });
  const shell = loadTestModule("components/ConnectedShell.tsx", { ...common,
    "@/components/SpatialNavigationContext": spatialContext, "@/components/SpatialNavigationBar": spatialBar,
    "@/components/PlatformNavigation": platform, "@/components/LogoutButton": logout,
    "@/components/LanguageSwitcher": language, "@/components/ContextualBoussole": { ContextualBoussole: () => null } });
  const globalLanguage = loadTestModule("components/GlobalLanguageSwitcher.tsx", { ...common, "@/components/LanguageSwitcher": language });
  return { ...shell, ...platform, ...globalLanguage, ...spatialContext, ...spatialBar };
}

export function renderShellFixture(pathname = "/dashboard", organizationName = "Organisation Goodissima") {
  const { ConnectedShell } = shellModules(pathname);
  return renderToStaticMarkup(jsx.jsx(ConnectedShell, { organizationName,
    children: jsx.jsxs("main", { className: "mx-auto max-w-6xl px-4 py-8 sm:px-6", children: [
      jsx.jsx("h1", { className: "text-3xl font-bold", children: "Contenu de page" }),
      jsx.jsx("p", { children: "Titre et actions métier conservés dans la page." }),
    ] }) }));
}
