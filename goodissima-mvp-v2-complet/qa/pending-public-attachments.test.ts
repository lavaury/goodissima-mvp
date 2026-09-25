import test from "node:test";
import assert from "node:assert/strict";
import { createPendingAttachmentTicket, readPendingAttachmentTickets } from "../lib/pending-public-attachments.ts";

const secret = "test-secret-that-is-long-enough-for-hmac-contract";
test("pending attachment tickets preserve stable metadata without signed URLs or file bytes", () => {
  process.env.RATE_LIMIT_HMAC_SECRET = secret;
  const attachment = { storageKey: "pending/link-1/id-proof.pdf", fileName: "proof.pdf", mimeType: "application/pdf", size: 321 };
  const token = createPendingAttachmentTicket({ ...attachment, gLinkId: "link-1" }, 1000);
  assert.deepEqual(readPendingAttachmentTickets([token], "link-1", 1001), [attachment]);
  assert.equal(JSON.stringify(readPendingAttachmentTickets([token], "link-1", 1001)).includes("signedUrl"), false);
});

test("pending attachment tickets reject another target, tampering and expiry", () => {
  process.env.RATE_LIMIT_HMAC_SECRET = secret;
  const token = createPendingAttachmentTicket({ storageKey: "pending/link-1/file.pdf", fileName: "file.pdf", mimeType: "application/pdf", size: 12, gLinkId: "link-1" }, 1000);
  assert.throws(() => readPendingAttachmentTickets([token], "link-2", 1001), /ATTACHMENTS_INVALID/);
  assert.throws(() => readPendingAttachmentTickets([`${token}x`], "link-1", 1001), /ATTACHMENTS_INVALID/);
  assert.throws(() => readPendingAttachmentTickets([token], "link-1", 1000 + 24 * 60 * 60 * 1000 + 1), /ATTACHMENTS_INVALID/);
});

test("zero and several attachments retain their exact stable references", () => {
  process.env.RATE_LIMIT_HMAC_SECRET = secret;
  assert.deepEqual(readPendingAttachmentTickets(undefined, "link-1"), []);
  const values = [0, 1, 2].map((index) => ({ storageKey: `pending/link-1/${index}.pdf`, fileName: `${index}.pdf`, mimeType: "application/pdf", size: index + 1 }));
  const tokens = values.map((value) => createPendingAttachmentTicket({ ...value, gLinkId: "link-1" }));
  assert.deepEqual(readPendingAttachmentTickets(tokens, "link-1"), values);
});
