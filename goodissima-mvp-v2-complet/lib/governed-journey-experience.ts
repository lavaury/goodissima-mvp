export type GovernedJourneyCurrentAction = { label: string; detail: string; href: string };

export function projectGovernedJourneyExperience(input: {
  humanValidated: boolean;
  totalParticipants: number;
  preparedInvitations: number;
  totalDocuments: number;
  receivedDocuments: number;
  pendingReviews: number;
  interventions: GovernedJourneyCurrentAction[];
}) {
  const pendingParticipants = Math.max(0, input.totalParticipants - input.preparedInvitations);
  const pendingDocuments = Math.max(0, input.totalDocuments - input.receivedDocuments);
  const allActions = [
    ...input.interventions,
    ...(pendingParticipants > 0 ? [{ label: "Invitez les participants prévus", detail: `${pendingParticipants} personne${pendingParticipants > 1 ? "s" : ""} sans invitation préparée`, href: "#people" }] : []),
    ...(pendingDocuments > 0 ? [{ label: "Examiner les documents attendus", detail: `${pendingDocuments} document${pendingDocuments > 1 ? "s" : ""} encore attendu${pendingDocuments > 1 ? "s" : ""}`, href: "#work" }] : []),
    ...(input.pendingReviews > 0 ? [{ label: "Poursuivre une décision", detail: `${input.pendingReviews} revue${input.pendingReviews > 1 ? "s" : ""} en attente`, href: "#decisions" }] : []),
  ];
  const actions = allActions.slice(0, 5);
  const situation = !input.humanValidated
    ? "Le cadrage du parcours reste à confirmer."
    : allActions.length > 0
      ? `${allActions.length} action${allActions.length > 1 ? "s" : ""} mérite${allActions.length > 1 ? "nt" : ""} votre attention.`
      : "Aucune action urgente n’est signalée pour le moment.";
  return { actions, totalActionCount: allActions.length, situation };
}
