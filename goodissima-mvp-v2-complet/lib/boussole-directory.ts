import type { CompassStep } from "./boussole-context.ts";
import type { BoussoleRuntimeContext } from "./boussole/contracts.ts";
import type { BoussoleSequence } from "./boussole-dashboard.ts";

const step = (id: string, targetId: string, title: string, body: string, optional = false): CompassStep => ({ id, targetId, title, body, detailedBody: body, optional, animation: { focus: "outline", movement: "scroll-center", narration: body, subtitles: body, duration: 7, transition: "soft-focus", tryNow: true } });

export const directorySequences: BoussoleSequence[] = [
  { id: "discover-directory", title: "Découvrir l’Annuaire", description: "Comprendre comment trouver des acteurs et choisir d’être trouvé.", applicableStates: ["EMPTY", "POPULATED"], steps: [
    step("directory-discovery-search", "directory-search", "Trouver des acteurs", "L’Annuaire recherche uniquement des personnes et organisations ayant volontairement publié leurs informations. Il ne retrouve pas vos objets Goodissima et ne cherche pas des opportunités."),
    step("directory-discovery-enrollment", "directory-enrollment", "Être trouvé volontairement", "Avoir un compte Goodissima ne vous rend pas visible dans l’Annuaire. Vous configurez et publiez vous-même votre inscription."),
  ] },
  { id: "search-directory", title: "Rechercher", description: "Décrire un acteur, relire les critères puis utiliser la recherche déterministe.", applicableStates: ["EMPTY", "POPULATED"], steps: [
    step("directory-search-natural", "directory-natural-search", "Décrire votre recherche", "L’assistant interprète votre phrase en critères. Il ne consulte pas l’Annuaire, ne propose aucun acteur et ne lance aucune recherche."),
    step("directory-search-filters", "directory-filters", "Vérifier les filtres", "Les filtres sont les critères réellement exécutés. Vous pouvez les modifier ou les retirer avant de lancer la recherche."),
    step("directory-search-understood", "directory-interpreted-criteria", "Relire les critères compris", "Cette zone apparaît après une interprétation réussie. Relisez-la : les critères non pris en charge sont signalés et ne sont jamais présentés comme respectés.", true),
    step("directory-search-real-result", "directory-first-result", "Premier résultat publié", "Ce profil est un résultat réellement publié correspondant aux filtres. Montrer la zone n’ouvre pas le profil.", true),
  ] },
  { id: "understand-directory-result", title: "Comprendre un résultat", description: "Lire les informations publiées et leur niveau de confiance.", applicableStates: ["POPULATED", "FOCUSED"], steps: [
    step("directory-result-card", "directory-first-result", "Lire un résultat", "La fiche montre uniquement les informations que cet acteur a publiées. « Déclaré » indique une information fournie ; « Vérifié » indique une vérification effective par Goodissima.", true),
    step("directory-result-focused", "directory-public-profile", "Lire le profil public", "Vous consultez un vrai profil public ouvert. Les informations affichées sont publiées ; aucune coordonnée privée, preuve ou relation n’est exposée.", true),
  ] },
  { id: "manage-directory-enrollment", title: "Mon inscription", description: "Choisir explicitement sa visibilité et ses informations publiées.", applicableStates: ["EMPTY", "POPULATED"], steps: [
    step("directory-enrollment-opt-in", "directory-enrollment", "Une inscription volontaire", "Votre compte n’est jamais inscrit automatiquement. Vous créez, publiez, désactivez et réactivez volontairement votre inscription."),
    step("directory-enrollment-information", "directory-identity", "Choisir les informations", "Chaque information est ajoutée en brouillon puis publiée ou retirée séparément. La Boussole ne modifie aucune information et ne déclenche aucune publication."),
  ] },
];

export const directorySteps = directorySequences.flatMap((sequence) => sequence.steps);

export function directoryRuntimeContext(contextId: string | undefined, pathname: string, targets: string[]): Partial<BoussoleRuntimeContext> {
  if (contextId !== "directory") return {};
  const focusedObjectId = pathname.match(/^\/annuaire\/([^/]+)\/?$/)?.[1];
  const populated = targets.includes("directory-first-result");
  return { pageState: focusedObjectId ? "FOCUSED" : populated ? "POPULATED" : "EMPTY", focusedObjectId, visibleObjectCount: focusedObjectId || populated ? 1 : 0 };
}
