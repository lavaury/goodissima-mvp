import { IdentityStatus, IdentityType, PrismaClient } from "@prisma/client";

import { resolveCandidateIdentityForAdmission } from "../lib/trust-identity";

const prisma = new PrismaClient();

function assertDemoScriptAllowed() {
  if (process.env.ALLOW_TRUST_DEMO_SCRIPT !== "true") {
    throw new Error(
      [
        "DEMO / STAGING ONLY: refusing to run candidate identity resolution demo script.",
        "Set ALLOW_TRUST_DEMO_SCRIPT=true explicitly to acknowledge this writes demo identity data.",
      ].join(" "),
    );
  }
}

async function main() {
  assertDemoScriptAllowed();

  const identity = await prisma.goodissimaIdentity.create({
    data: {
      type: IdentityType.PERSON,
      status: IdentityStatus.UNVERIFIED,
    },
  });

  const withIdentity = await resolveCandidateIdentityForAdmission(prisma, {
    candidateIdentityId: identity.id,
  });
  const withoutIdentity = await resolveCandidateIdentityForAdmission(prisma, {});

  console.log("DEMO / STAGING ONLY - Candidate identity resolution results.");
  console.log(
    JSON.stringify(
      {
        demoIdentityId: identity.id,
        withIdentity,
        withoutIdentity,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
