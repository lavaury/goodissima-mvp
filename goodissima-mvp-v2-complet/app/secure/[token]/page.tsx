import { RelationCaseWorkspace } from "@/components/RelationCaseWorkspace";
import { resolveCandidateSecureAccess } from "@/lib/candidate-access";
import { prisma } from "@/lib/prisma";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type FailureStep = "resolver" | "case-load" | "messages-load" | "link-load" | "template-load" | "workspace-load" | "owner-load" | "render-guard" | "unknown";

function logDiagnostic(input: { tokenPrefix: string; accessResolved: boolean; relationCaseId?: string; failureStep?: FailureStep }) {
  if (process.env.NODE_ENV === "production" && process.env.GOODISSIMA_DEBUG !== "true") return;
  console.info("[candidate-secure-access]", {
    route: "/secure/[token]",
    tokenPrefix: input.tokenPrefix,
    accessResolved: input.accessResolved,
    ...(input.relationCaseId ? { relationCaseId: input.relationCaseId } : {}),
    ...(input.failureStep ? { failureStep: input.failureStep } : {}),
  });
}

export default async function SecureCasePage({ params }: { params: { token: string } }) {
  noStore();
  const token = typeof params.token === "string" ? params.token : "";
  const tokenPrefix = token.slice(0, 6);
  let access: Awaited<ReturnType<typeof resolveCandidateSecureAccess>>;

  try {
    access = await resolveCandidateSecureAccess(token);
  } catch {
    logDiagnostic({ tokenPrefix, accessResolved: false, failureStep: "resolver" });
    notFound();
  }
  if (!access) {
    logDiagnostic({ tokenPrefix, accessResolved: false, failureStep: "resolver" });
    notFound();
  }

  const relationCaseId = access.id;
  logDiagnostic({ tokenPrefix, accessResolved: true, relationCaseId });
  let item: Awaited<ReturnType<typeof prisma.relationCase.findUnique>>;
  try {
    // Scalar data first: a broken legacy relation must not reject a valid case.
    item = await prisma.relationCase.findUnique({ where: { id: relationCaseId } });
  } catch {
    logDiagnostic({ tokenPrefix, accessResolved: true, relationCaseId, failureStep: "case-load" });
    notFound();
  }
  if (!item) {
    logDiagnostic({ tokenPrefix, accessResolved: true, relationCaseId, failureStep: "case-load" });
    notFound();
  }

  const [messagesResult, linkResult, templateResult, workspaceResult, ownerResult, supportingResult] = await Promise.allSettled([
    prisma.message.findMany({ where: { caseId: relationCaseId }, orderBy: { createdAt: "asc" } }),
    prisma.gLink.findUnique({ where: { id: item.gLinkId }, select: { id: true, title: true, slug: true } }),
    item.templateId ? prisma.relationTemplate.findUnique({ where: { id: item.templateId }, select: { id: true } }) : Promise.resolve(null),
    item.workspaceId
      ? prisma.workspace.findUnique({ where: { id: item.workspaceId }, select: { id: true, name: true, slug: true, category: true, kind: true } })
      : Promise.resolve(null),
    prisma.user.findUnique({ where: { id: item.ownerId }, select: { id: true } }),
    Promise.all([
      prisma.document.findMany({ where: { caseId: relationCaseId }, orderBy: { createdAt: "desc" } }),
      prisma.communicationSession.findMany({ where: { relationCaseId }, orderBy: { createdAt: "desc" } }),
      prisma.relationAction.findMany({ where: { relationCaseId }, orderBy: [{ status: "asc" }, { createdAt: "desc" }] }),
      prisma.auditLog.findMany({ where: { caseId: relationCaseId }, orderBy: { createdAt: "desc" } }),
      prisma.relationEvent.findMany({ where: { caseId: relationCaseId }, orderBy: { createdAt: "desc" } }),
    ]),
  ]);

  const diagnostics: Array<[PromiseSettledResult<unknown>, FailureStep]> = [
    [messagesResult, "messages-load"], [linkResult, "link-load"], [templateResult, "template-load"],
    [workspaceResult, "workspace-load"], [ownerResult, "owner-load"], [supportingResult, "unknown"],
  ];
  for (const [result, failureStep] of diagnostics) {
    if (result.status === "rejected") logDiagnostic({ tokenPrefix, accessResolved: true, relationCaseId, failureStep });
  }

  const messages = messagesResult.status === "fulfilled" ? messagesResult.value : [];
  const gLink = linkResult.status === "fulfilled" ? linkResult.value : null;
  const workspace = workspaceResult.status === "fulfilled" ? workspaceResult.value : null;
  const [documents, communicationSessions, relationActions, auditLogs, relationEvents] =
    supportingResult.status === "fulfilled" ? supportingResult.value : [[], [], [], [], []];
  const incompleteContext = !gLink
    || (Boolean(item.templateId) && (templateResult.status === "rejected" || !templateResult.value))
    || (Boolean(item.workspaceId) && !workspace)
    || ownerResult.status === "rejected" || !ownerResult.value;

  const compatibleItem = {
    ...item,
    gLink: gLink ?? { id: item.gLinkId, title: "Ancienne annonce", slug: null },
    workspace, messages, documents, communicationSessions, relationActions, auditLogs, relationEvents,
  };

  return (
    <>
      {incompleteContext ? (
        <p className="mx-auto mt-6 max-w-5xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Certains éléments de contexte de cette ancienne annonce ne sont pas disponibles, mais la conversation reste accessible.
        </p>
      ) : null}
      <RelationCaseWorkspace item={compatibleItem} senderType="CANDIDATE" candidateAccessToken={item.candidateAccessToken} />
    </>
  );
}
