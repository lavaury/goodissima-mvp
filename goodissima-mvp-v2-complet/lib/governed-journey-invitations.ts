import { createHash, randomBytes } from "crypto";

export function hashJourneyInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createJourneyInvitationToken() {
  return randomBytes(32).toString("base64url");
}
