export type SecureLinkTemplatePreview = {
  id: string;
  name: string;
  status: string;
  photos: string[];
  attachments: string[];
  verifiedLinks: string[];
  verificationRequired: boolean;
};

export type SecureLinkPreviewInput = {
  title: string;
  city: string;
  description: string;
  template: SecureLinkTemplatePreview | null;
};

export function buildSecureLinkListingPreview(input: SecureLinkPreviewInput) {
  const hasVerifiedPhoto = Boolean(input.template?.photos.length);
  const hasVerifiedLink = Boolean(input.template?.verifiedLinks.length);
  return {
    title: input.title.trim() || "Titre de votre annonce",
    city: input.city.trim() || "Localisation à préciser",
    description: input.description.trim() || "Ajoutez une courte description pour présenter cette opportunité.",
    journeyName: input.template?.name ?? "Parcours à sélectionner",
    photos: input.template?.photos ?? [],
    attachments: input.template?.attachments ?? [],
    verifiedLinks: input.template?.verifiedLinks ?? [],
    badges: [
      "Brouillon",
      "Lien sécurisé",
      input.template?.verificationRequired ? "Vérification requise" : "Vérification non requise",
      hasVerifiedPhoto ? "Photo vérifiée" : "Photo non vérifiée",
      hasVerifiedLink ? "Lien vérifié" : "Lien externe non vérifié",
    ],
  };
}

export function secureLinkGenerationState(slug?: string | null) {
  return slug ? "GENERATED" as const : "DRAFT" as const;
}
