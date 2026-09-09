export type BreadcrumbItem = { label: string; href?: string };
const home: BreadcrumbItem = { label: "Accueil", href: "/dashboard" };
const spaces: BreadcrumbItem = { label: "Mes espaces", href: "/gouvernance" };

// Explicit page vocabulary, never labels derived from URL segments.
const pages: Record<string, { label: string; parent?: string }> = {
  "/dashboard": { label: "Accueil" },
  "/recherche": { label: "Recherche Goodissima" },
  "/boussole": { label: "Boussole" },
  "/boussole/decouverte": { label: "Boussole" },
  "/annuaire": { label: "Annuaire" },
  "/gouvernance": { label: "Mes espaces" },
  "/identity": { label: "Identité" },
  "/settings": { label: "Paramètres" },
  "/gouvernance/portfolios": { label: "Portfolios", parent: "/gouvernance" },
  "/gouvernance/portfolios/nouveau": { label: "Créer un Portfolio", parent: "/gouvernance/portfolios" },
  "/gouvernance/workspaces/nouveau": { label: "Créer un Workspace", parent: "/gouvernance" },
  "/gouvernance/nouveau": { label: "Créer un parcours gouverné", parent: "/gouvernance" },
  "/gouvernance/pilotage": { label: "Salle de pilotage", parent: "/gouvernance" },
  "/links/simple": { label: "Créer un lien simple", parent: "/gouvernance" },
  "/links/new": { label: "Créer un lien", parent: "/opportunities" },
  "/opportunities": { label: "Opportunités" },
  "/opportunities/new": { label: "Créer une opportunité", parent: "/opportunities" },
  "/relations": { label: "Relations" },
  "/cases": { label: "Dossiers relationnels" },
  "/parcours": { label: "Parcours" },
  "/templates": { label: "Parcours" },
  "/templates/demo": { label: "Démonstration de parcours", parent: "/parcours" },
  "/trust/connectors": { label: "Confiance" },
  "/administration": { label: "Administration" },
  "/administration/feedback": { label: "Retours utilisateurs", parent: "/administration" },
  "/ia-valeur": { label: "IA & Valeur" },
  "/admin/ai-costs": { label: "IA & Valeur" },
  "/analytics": { label: "Statistiques" },
  "/experience": { label: "Démonstration Goodissima" },
};
const detailPages = [
  { pattern: /^\/gouvernance\/workspaces\/[^/]+$/, label: "Workspace" },
  { pattern: /^\/gouvernance\/portfolios\/[^/]+\/pilotage$/, label: "Pilotage du Portfolio" },
  { pattern: /^\/gouvernance\/portfolios\/[^/]+$/, label: "Portfolio" },
  { pattern: /^\/gouvernance\/parcours\/[^/]+\/pilotage$/, label: "Parcours gouverné" },
  { pattern: /^\/cases\/[^/]+$/, label: "Dossier relationnel" },
  { pattern: /^\/links\/[^/]+$/, label: "Lien" },
  { pattern: /^\/templates\/[^/]+$/, label: "Parcours" },
];

export function isConnectedPathname(pathname: string): boolean {
  return Boolean(pages[pathname]) || detailPages.some(page => page.pattern.test(pathname));
}

export function needsEntityContext(pathname: string): boolean {
  return !pages[pathname] && detailPages.some(page => page.pattern.test(pathname));
}

export function pageBreadcrumb(pathname: string): BreadcrumbItem[] {
  if (pathname === "/dashboard") return [{ label: "Accueil" }];
  const page = pages[pathname];
  if (page) {
    const parent = page.parent ? pageBreadcrumb(page.parent).map((item, index, all) => index === all.length - 1 ? { ...item, href: page.parent } : item) : [home];
    return [...parent, { label: page.label }];
  }
  const detail = detailPages.find(page => page.pattern.test(pathname));
  // Await the authorized page's entity data: do not infer an object parent.
  return detail ? [home, { label: detail.label }] : [{ label: "Page courante" }];
}

export function logicalParent(items: BreadcrumbItem[]): BreadcrumbItem | null {
  return [...items.slice(0, -1)].reverse().find(item => item.href) ?? null;
}

export function businessLabel(value: string | null | undefined, fallback: string, technicalIds: string[] = []): string {
  const label = value?.trim();
  if (!label || technicalIds.some(id => id && label.includes(id))) return fallback;
  if (/https?:\/\/|[?&][\w-]+=|(?:token|secret)\s*[=:]|\b[\da-f]{8}-[\da-f-]{27,}\b|\b[\da-f]{32,}\b|\bc[a-z0-9]{23,24}\b|\b[a-z0-9_-]{40,}\b/i.test(label)) return fallback;
  return label;
}

export const navigationWorkspaceSelect = {
  id: true, name: true, ownerId: true,
  portfolio: { select: { id: true, name: true, ownerId: true } },
} as const;
type WorkspaceContext = {
  id: string; name: string; ownerId: string;
  portfolio: { id: string; name: string; ownerId: string } | null;
};

export function objectBreadcrumb(input: {
  name: string; fallback: string; objectId: string; ownerId: string;
  workspace?: WorkspaceContext | null;
}): BreadcrumbItem[] {
  const workspace = input.workspace?.ownerId === input.ownerId ? input.workspace : null;
  const portfolio = workspace?.portfolio?.ownerId === input.ownerId ? workspace.portfolio : null;
  const ids = [input.objectId, workspace?.id ?? "", portfolio?.id ?? ""];
  return [home, spaces,
    ...(portfolio ? [{ label: businessLabel(portfolio.name, "Portfolio", ids), href: `/gouvernance/portfolios/${encodeURIComponent(portfolio.id)}` }] : []),
    ...(workspace ? [{ label: businessLabel(workspace.name, "Workspace", ids), href: `/gouvernance/workspaces/${encodeURIComponent(workspace.id)}` }] : []),
    { label: businessLabel(input.name, input.fallback, ids) },
  ];
}

export function workspaceBreadcrumb(workspace: WorkspaceContext): BreadcrumbItem[] {
  const items = objectBreadcrumb({ name: workspace.name, fallback: "Workspace", objectId: workspace.id, ownerId: workspace.ownerId, workspace });
  return [...items.slice(0, -2), { label: businessLabel(workspace.name, "Workspace", [workspace.id]) }];
}

export function portfolioBreadcrumb(portfolio: { id: string; name: string }, pilotage = false): BreadcrumbItem[] {
  const label = businessLabel(portfolio.name, "Portfolio", [portfolio.id]);
  return pilotage
    ? [home, spaces, { label, href: `/gouvernance/portfolios/${encodeURIComponent(portfolio.id)}` }, { label: "Piloter" }]
    : [home, spaces, { label }];
}

export function workspaceCreationBreadcrumb(portfolio: { id: string; name: string } | null): BreadcrumbItem[] {
  if (!portfolio) return pageBreadcrumb("/gouvernance/workspaces/nouveau");
  return [home, spaces, { label: businessLabel(portfolio.name, "Portfolio", [portfolio.id]),
    href: `/gouvernance/portfolios/${encodeURIComponent(portfolio.id)}` }, { label: "Créer un Workspace" }];
}
