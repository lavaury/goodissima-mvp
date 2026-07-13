import Link from "next/link";
import { cookies } from "next/headers";
import { activeCandidateAccessWhere } from "@/lib/candidate-access";
import { prisma } from "@/lib/prisma";
import { secureTokenHash, secureTrace } from "@/lib/secure-trace";

export default async function ConfirmationPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { token?: string };
}) {
  const link = await prisma.gLink.findUnique({
    where: { slug: params.slug },
    select: { id: true },
  });
  const cookieToken = link ? cookies().get(`goodissima_candidate_${link.id}`)?.value?.trim() : "";
  const legacyQueryToken = typeof searchParams.token === "string" ? searchParams.token.trim() : "";
  const candidateTokens = [cookieToken, legacyQueryToken].filter(Boolean) as string[];
  let candidateAccessToken = "";

  for (const token of candidateTokens) {
    const relationCase = link
      ? await prisma.relationCase.findFirst({
          where: { ...activeCandidateAccessWhere(token), gLinkId: link.id },
          select: { id: true, candidateAccessToken: true },
        })
      : null;
    if (relationCase) {
      candidateAccessToken = relationCase.candidateAccessToken;
      secureTrace("candidate_redirect", {
        relationCaseId: relationCase.id,
        targetKind: "candidate-secure-token",
        tokenHash: await secureTokenHash(candidateAccessToken),
      });
      break;
    }
  }

  if (!candidateAccessToken && legacyQueryToken) {
    secureTrace("candidate_redirect", {
      targetKind: "unknown",
      tokenHash: await secureTokenHash(legacyQueryToken),
    });
  }
  const caseUrl = candidateAccessToken
    ? `/secure/${encodeURIComponent(candidateAccessToken)}`
    : `/l/${params.slug}`;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6">
      <div className="rounded-3xl border bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Goodissima - Relation securisee
        </p>
        <div className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-3xl">
          OK
        </div>
        <h1 className="mt-6 text-3xl font-bold">Votre demande a ete envoyee</h1>
        <p className="mt-4 text-slate-600">
          Le proprietaire va pouvoir vous repondre dans ce dossier securise. Vous pouvez revenir a cet espace a tout moment.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href={caseUrl} className="rounded-2xl bg-slate-900 px-5 py-3 text-white">
            Acceder a la conversation securisee
          </Link>
          <Link href={`/l/${params.slug}`} className="rounded-2xl border px-5 py-3">
            Revenir a l'annonce
          </Link>
        </div>
      </div>
    </main>
  );
}
