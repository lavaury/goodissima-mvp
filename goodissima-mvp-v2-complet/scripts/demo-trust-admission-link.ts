import { IdentityStatus, IdentityType, PrismaClient } from "@prisma/client";

import { createTrustAdmissionToken } from "../lib/trust-admission-tokens";

const prisma = new PrismaClient();

function assertDemoScriptAllowed() {
  if (process.env.ALLOW_TRUST_DEMO_SCRIPT !== "true") {
    throw new Error(
      [
        "DEMO / STAGING ONLY: refusing to run trust admission link demo script.",
        "Set ALLOW_TRUST_DEMO_SCRIPT=true explicitly to acknowledge this writes demo trust data.",
      ].join(" "),
    );
  }
}

function getPilotGLinkId() {
  const gLinkId = process.env.TRUST_ADMISSION_PILOT_GLINK_ID?.trim();

  if (!gLinkId) {
    throw new Error("TRUST_ADMISSION_PILOT_GLINK_ID is required.");
  }

  return gLinkId;
}

function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  ).replace(/\/$/, "");
}

function createAdmissionUrl(input: { slug: string; token: string }) {
  return `${getAppUrl()}/l/${encodeURIComponent(input.slug)}?trustAdmissionToken=${encodeURIComponent(input.token)}`;
}

function createTokenPreview(token: string) {
  return `${token.slice(0, 6)}...${token.slice(-6)}`;
}

async function main() {
  assertDemoScriptAllowed();

  const gLinkId = getPilotGLinkId();
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

  const identity = await prisma.goodissimaIdentity.create({
    data: {
      type: IdentityType.PERSON,
      status: IdentityStatus.UNVERIFIED,
    },
  });
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const createdToken = await createTrustAdmissionToken(prisma, {
    identityId: identity.id,
    gLinkId: gLink.id,
    expiresAt,
  });

  console.log("DEMO / STAGING ONLY - Trust admission link created.");
  console.log(
    JSON.stringify(
      {
        gLinkId: gLink.id,
        slug: gLink.slug,
        title: gLink.title,
        identityId: identity.id,
        tokenId: createdToken.tokenId,
        tokenPreview: createTokenPreview(createdToken.token),
        expiresAt: createdToken.expiresAt,
        admissionUrl: createAdmissionUrl({
          slug: gLink.slug,
          token: createdToken.token,
        }),
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
