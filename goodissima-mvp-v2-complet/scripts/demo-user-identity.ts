import { PrismaClient } from "@prisma/client";

import { getOrCreateGoodissimaIdentityForUser } from "../lib/user-identity";

const prisma = new PrismaClient();

function assertDemoScriptAllowed() {
  if (process.env.ALLOW_TRUST_DEMO_SCRIPT !== "true") {
    throw new Error(
      [
        "DEMO / STAGING ONLY: refusing to run user identity demo script.",
        "Set ALLOW_TRUST_DEMO_SCRIPT=true explicitly to acknowledge this writes demo user identity data.",
      ].join(" "),
    );
  }
}

function getDemoUserId() {
  const userId = process.env.DEMO_USER_ID?.trim();

  if (!userId) {
    throw new Error("DEMO_USER_ID is required.");
  }

  return userId;
}

async function main() {
  assertDemoScriptAllowed();

  const userId = getDemoUserId();
  const result = await getOrCreateGoodissimaIdentityForUser(prisma, { userId });

  console.log("DEMO / STAGING ONLY - User Goodissima identity resolved.");
  console.log(
    JSON.stringify(
      {
        userId,
        identityId: result.identityId,
        identityCreated: result.identityCreated,
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
