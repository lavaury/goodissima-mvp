import { IdentityStatus, IdentityType, type PrismaClient } from "@prisma/client";

export type UserIdentityClient = PrismaClient;

export type GetOrCreateGoodissimaIdentityForUserInput = {
  userId: string;
};

export type GetOrCreateGoodissimaIdentityForUserResult = {
  identityId: string;
  identityCreated: boolean;
};

export async function getOrCreateGoodissimaIdentityForUser(
  prisma: UserIdentityClient,
  input: GetOrCreateGoodissimaIdentityForUserInput,
): Promise<GetOrCreateGoodissimaIdentityForUserResult> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      goodissimaIdentityId: true,
      goodissimaIdentity: {
        select: { id: true },
      },
    },
  });

  if (!user) {
    throw new Error(`User not found: ${input.userId}`);
  }

  if (user.goodissimaIdentityId && user.goodissimaIdentity) {
    return {
      identityId: user.goodissimaIdentityId,
      identityCreated: false,
    };
  }

  return prisma.$transaction(async (tx) => {
    const currentUser = await tx.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        goodissimaIdentityId: true,
        goodissimaIdentity: {
          select: { id: true },
        },
      },
    });

    if (!currentUser) {
      throw new Error(`User not found: ${input.userId}`);
    }

    if (currentUser.goodissimaIdentityId && currentUser.goodissimaIdentity) {
      return {
        identityId: currentUser.goodissimaIdentityId,
        identityCreated: false,
      };
    }

    const identity = await tx.goodissimaIdentity.create({
      data: {
        type: IdentityType.PERSON,
        status: IdentityStatus.UNVERIFIED,
      },
      select: { id: true },
    });

    await tx.user.update({
      where: { id: currentUser.id },
      data: { goodissimaIdentityId: identity.id },
      select: { id: true },
    });

    return {
      identityId: identity.id,
      identityCreated: true,
    };
  });
}
