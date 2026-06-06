import { IdentityStatus, IdentityType, PrismaClient } from "@prisma/client";

import {
  createTrustAdmissionToken,
  resolveTrustAdmissionToken,
} from "../lib/trust-admission-tokens";

const prisma = new PrismaClient();

function assertDemoScriptAllowed() {
  if (process.env.ALLOW_TRUST_DEMO_SCRIPT !== "true") {
    throw new Error(
      [
        "DEMO / STAGING ONLY: refusing to run trust admission token demo script.",
        "Set ALLOW_TRUST_DEMO_SCRIPT=true explicitly to acknowledge this writes demo trust data.",
      ].join(" "),
    );
  }
}

function getOptionalPilotGLinkId() {
  const gLinkId = process.env.TRUST_ADMISSION_PILOT_GLINK_ID?.trim();
  return gLinkId || null;
}

function createTokenPreview(token: string) {
  return `${token.slice(0, 6)}...${token.slice(-6)}`;
}

async function assertGLinkExists(gLinkId: string | null) {
  if (!gLinkId) return null;

  const gLink = await prisma.gLink.findUnique({
    where: { id: gLinkId },
    select: {
      id: true,
      title: true,
      slug: true,
    },
  });

  if (!gLink) {
    throw new Error(`GLink not found: ${gLinkId}`);
  }

  return gLink;
}

async function main() {
  assertDemoScriptAllowed();

  const gLinkId = getOptionalPilotGLinkId();
  const gLink = await assertGLinkExists(gLinkId);
  const identity = await prisma.goodissimaIdentity.create({
    data: {
      type: IdentityType.PERSON,
      status: IdentityStatus.UNVERIFIED,
    },
  });
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const createdToken = await createTrustAdmissionToken(prisma, {
    identityId: identity.id,
    gLinkId,
    expiresAt,
  });
  const resolution = await resolveTrustAdmissionToken(prisma, {
    token: createdToken.token,
    gLinkId,
  });

  console.log("DEMO / STAGING ONLY - Trust admission token results.");
  console.log(
    JSON.stringify(
      {
        tokenId: createdToken.tokenId,
        tokenPreview: createTokenPreview(createdToken.token),
        resolved: resolution.resolved,
        identityId: resolution.identityId,
        reasons: resolution.reasons,
        gLink,
        expiresAt: createdToken.expiresAt,
        fullTokenLogged: false,
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
