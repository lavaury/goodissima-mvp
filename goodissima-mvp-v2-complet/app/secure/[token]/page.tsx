import { RelationCaseWorkspace } from "@/components/RelationCaseWorkspace";
import { resolveCandidateSecureAccess } from "@/lib/candidate-access";
import { prisma } from "@/lib/prisma";
import { secureTokenHash, secureTrace, secureTraceEnvironment } from "@/lib/secure-trace";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SecureCasePage({ params }: { params: { token: string } }) {
  noStore();
  const token = typeof params.token === "string" ? params.token : "";
  const tokenHash = await secureTokenHash(token);
  secureTrace("page_hit", {
    route: "/secure/[token]",
    paramsShape: typeof params?.token === "string" ? "token-string" : "token-missing",
    tokenLength: token.length,
    tokenHash,
    env: secureTraceEnvironment(),
  });
  let access: Awaited<ReturnType<typeof resolveCandidateSecureAccess>>;

  try {
    access = await resolveCandidateSecureAccess(token);
  } catch {
    secureTrace("render_mode", { route: "/secure/[token]", tokenHash, mode: "not-found", failureStep: "resolver" });
    notFound();
  }
  if (!access) {
    secureTrace("render_mode", { route: "/secure/[token]", tokenHash, mode: "not-found", failureStep: "resolver" });
    notFound();
  }

  const relationCaseId = access.id;
  secureTrace("case_load_start", { route: "/secure/[token]", tokenHash, relationCaseId });
  let item: Awaited<ReturnType<typeof prisma.relationCase.findUnique>>;
  try {
    // Scalar data first: a broken legacy relation must not reject a valid case.
    item = await prisma.relationCase.findUnique({ where: { id: relationCaseId } });
  } catch {
    secureTrace("case_load_result", { tokenHash, relationCaseId, found: false, failureCode: "query-error" });
    secureTrace("render_mode", { tokenHash, relationCaseId, mode: "not-found", failureStep: "case-load" });
    notFound();
  }
  if (!item) {
    secureTrace("case_load_result", { tokenHash, relationCaseId, found: false, failureCode: "case-missing" });
    secureTrace("render_mode", { tokenHash, relationCaseId, mode: "not-found", failureStep: "case-load" });
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

  const messages = messagesResult.status === "fulfilled" ? messagesResult.value : [];
  const gLink = linkResult.status === "fulfilled" ? linkResult.value : null;
  const workspace = workspaceResult.status === "fulfilled" ? workspaceResult.value : null;
  const [documents, communicationSessions, relationActions, auditLogs, relationEvents] =
    supportingResult.status === "fulfilled" ? supportingResult.value : [[], [], [], [], []];
  const incompleteContext = !gLink
    || (Boolean(item.templateId) && (templateResult.status === "rejected" || !templateResult.value))
    || (Boolean(item.workspaceId) && !workspace)
    || ownerResult.status === "rejected" || !ownerResult.value;

  secureTrace("case_load_result", {
    tokenHash,
    relationCaseId,
    found: true,
    status: item.status,
    hasGLink: Boolean(gLink),
    hasTemplate: templateResult.status === "fulfilled" && Boolean(templateResult.value),
    hasWorkspace: Boolean(workspace),
    hasOwner: ownerResult.status === "fulfilled" && Boolean(ownerResult.value),
    messagesCount: messages.length,
  });
  const supportingDataMissing = messagesResult.status === "rejected" || supportingResult.status === "rejected";
  secureTrace("render_mode", {
    tokenHash,
    relationCaseId,
    mode: supportingDataMissing ? "minimal-conversation" : incompleteContext ? "legacy-compatible" : "full-context",
  });

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
