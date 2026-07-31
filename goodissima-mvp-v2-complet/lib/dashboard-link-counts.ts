type DashboardRelationCase = {
  status: string;
  relationActions: Array<{ status: string }>;
};

export function getDashboardLinkCounts(cases: DashboardRelationCase[]) {
  const dossierCount = cases.length;

  return {
    dossierCount,
    receivedRequestCount: dossierCount,
    pendingActionCount: cases.reduce(
      (count, relationCase) =>
        count + relationCase.relationActions.filter((action) => action.status !== "COMPLETED").length,
      0,
    ),
  };
}
