export type ProductObject = "journey" | "announcement" | "merge" | "relationshipRequest" | "relation" | "workspace";

export const productObjectDefinitions = {
  journey: "Modèle de travail réutilisable définissant les étapes, acteurs, validations et documents.",
  announcement: "Opportunité publiée ou partageable décrivant ce qui est recherché.",
  relation: "Espace sécurisé de collaboration créé après acceptation d'une mise en relation.",
  workspace: "Espace opérationnel permettant de piloter la relation.",
} as const;

export const productObjectGuidance = {
  journey: "Ce parcours servira de modèle pour créer une ou plusieurs annonces.",
  announcement: "Cette annonce est basée sur un parcours et peut être publiée ou partagée via un lien sécurisé.",
  relation: "Cette relation provient d'une mise en relation acceptée.",
} as const;

export const productLifecycle: Array<{ id: ProductObject; label: string }> = [
  { id: "journey", label: "Parcours" },
  { id: "announcement", label: "Annonce" },
  { id: "merge", label: "Merge" },
  { id: "relationshipRequest", label: "Demande de relation" },
  { id: "relation", label: "Relation" },
  { id: "workspace", label: "Workspace" },
];

export const productVoiceVocabulary = {
  journey: "un parcours",
  announcement: "une annonce",
  relation: "une relation",
} as const;

export function productObjectDefinition(object: keyof typeof productObjectDefinitions) {
  return productObjectDefinitions[object];
}
