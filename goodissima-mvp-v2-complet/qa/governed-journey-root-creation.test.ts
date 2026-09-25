import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createJourneyRootAndCreated, createdJourneyReadbackMatches, journeyCreationTemplateKey } from "../lib/governed-journey-root-creation.ts";

const actions = readFileSync("lib/governance-journey-actions.ts", "utf8");
const page = readFileSync("app/(connected)/gouvernance/nouveau/page.tsx", "utf8");
const assistant = readFileSync("app/(connected)/gouvernance/nouveau/GovernanceJourneyAssistant.tsx", "utf8");

const expected = {
  id: "journey-1", relationTemplateId: "template-1", formTemplateId: "form-1",
  authorityUserId: "authenticated-user", relationCaseId: null,
};
const goodReadback = {
  ...expected, status: "DRAFT", events: [{
    type: "CREATED", sequence: 1, fromStatus: null, toStatus: "DRAFT",
    actorUserId: expected.authorityUserId, authorityUserId: expected.authorityUserId,
    relationCaseId: null,
  }],
};

test("root and CREATED use the server authority and check M2 last, without a Case or Workspace", async () => {
  const operations: string[] = [];
  let rootData: Record<string, unknown> = {};
  let eventData: Record<string, unknown> = {};
  const tx = {
    governedJourney: { create: async ({ data }: { data: Record<string, unknown> }) => {
      operations.push("root"); rootData = data; return data;
    } },
    governedJourneyEvent: { create: async ({ data }: { data: Record<string, unknown> }) => {
      operations.push("created"); eventData = data; return data;
    } },
    $executeRawUnsafe: async (sql: string) => { operations.push(sql); return 0; },
  } as unknown as Parameters<typeof createJourneyRootAndCreated>[0];
  const result = await createJourneyRootAndCreated(tx, {
    relationTemplateId: expected.relationTemplateId,
    formTemplateId: expected.formTemplateId,
    createdFromTemplateVersionId: "version-1",
    authorityUserId: expected.authorityUserId,
    relationCaseId: null,
    title: "Parcours sans Workspace",
  });
  assert.deepEqual(operations, ["root", "created", 'SET CONSTRAINTS "GovernedJourney_created_at_commit" IMMEDIATE']);
  assert.equal(rootData.authorityUserId, expected.authorityUserId);
  assert.equal(rootData.relationCaseId, null);
  assert.equal(rootData.status, "DRAFT");
  assert.equal(eventData.governedJourneyId, result.id);
  assert.equal(eventData.actorUserId, expected.authorityUserId);
  assert.equal(eventData.authorityUserId, expected.authorityUserId);
  assert.equal(eventData.relationCaseId, null);
  assert.equal(eventData.type, "CREATED");
  assert.equal(eventData.sequence, 1);
  assert.equal(eventData.fromStatus, null);
  assert.equal(eventData.toStatus, "DRAFT");
});

test("M2 failure rejects before transaction callback can report success", async () => {
  const tx = {
    governedJourney: { create: async ({ data }: { data: Record<string, unknown> }) => data },
    governedJourneyEvent: { create: async ({ data }: { data: Record<string, unknown> }) => data },
    $executeRawUnsafe: async () => { throw new Error("P2010 / P0001"); },
  } as unknown as Parameters<typeof createJourneyRootAndCreated>[0];
  await assert.rejects(createJourneyRootAndCreated(tx, {
    relationTemplateId: "template-1", formTemplateId: "form-1",
    createdFromTemplateVersionId: "version-1", authorityUserId: "authenticated-user",
    relationCaseId: null, title: "Parcours",
  }), /P2010/);
});

test("CREATED failure prevents M2 success and leaves rollback to the enclosing transaction", async () => {
  const operations: string[] = [];
  const tx = {
    governedJourney: { create: async ({ data }: { data: Record<string, unknown> }) => {
      operations.push("root"); return data;
    } },
    governedJourneyEvent: { create: async () => { operations.push("event"); throw new Error("EVENT_FAILED"); } },
    $executeRawUnsafe: async () => { operations.push("set"); return 0; },
  } as unknown as Parameters<typeof createJourneyRootAndCreated>[0];
  await assert.rejects(createJourneyRootAndCreated(tx, {
    relationTemplateId: "template-1", formTemplateId: "form-1",
    createdFromTemplateVersionId: "version-1", authorityUserId: "authenticated-user",
    relationCaseId: null, title: "Parcours",
  }), /EVENT_FAILED/);
  assert.deepEqual(operations, ["root", "event"]);
  assert.match(actions, /prisma\.\$transaction\(async \(tx\) => \{/);
});

test("read-back requires one matching CREATED and rejects missing or inconsistent state", () => {
  assert.equal(createdJourneyReadbackMatches(goodReadback, { ...expected, id: "other-journey" }), false);
  const identity = { ...expected, id: "journey-1" };
  assert.equal(createdJourneyReadbackMatches(goodReadback, identity), true);
  assert.equal(createdJourneyReadbackMatches(null, identity), false);
  assert.equal(createdJourneyReadbackMatches({ ...goodReadback, events: [] }, identity), false);
  assert.equal(createdJourneyReadbackMatches({ ...goodReadback, events: [...goodReadback.events, ...goodReadback.events] }, identity), false);
  assert.equal(createdJourneyReadbackMatches({ ...goodReadback, events: [{ ...goodReadback.events[0], actorUserId: "other" }] }, identity), false);
  assert.equal(createdJourneyReadbackMatches({ ...goodReadback, relationCaseId: "invented-case" }, identity), false);
});

test("double submit uses one stable template key, while distinct requests remain distinct", () => {
  const key = "8d2d55ca-0dc7-45d0-8fb4-a45de943a513";
  assert.equal(journeyCreationTemplateKey("owner", key), journeyCreationTemplateKey("owner", key));
  assert.notEqual(journeyCreationTemplateKey("owner", key), journeyCreationTemplateKey("other-owner", key));
  assert.notEqual(journeyCreationTemplateKey("owner", key), journeyCreationTemplateKey("owner", "9d2d55ca-0dc7-45d0-8fb4-a45de943a513"));
  assert.match(actions, /if \(!isUniqueConflict\(error\)\)/);
  assert.match(actions, /creationRequestFingerprint: requestFingerprint/);
});

test("both creation surfaces submit one request key; no automatic side objects", () => {
  assert.match(page, /name="requestKey" value=\{randomUUID\(\)\}/);
  assert.match(page, /requestKey=\{randomUUID\(\)\}/);
  assert.match(assistant, /formData\.set\("requestKey", requestKey\)/);
  assert.match(actions, /journeyCreationTemplateKey\(owner\.id, requestKey\)/);
  assert.match(actions, /createJourneyRootAndCreated\(tx/);
  assert.match(actions, /createdJourneyReadbackMatches\(readback, created\)/);
  assert.doesNotMatch(actions, /tx\.(?:workspace|relationCase|governedJourneyInvitation|governedJourneyConsent|governedJourneyExpectedRoleAssignment|governedMeetingParticipant|governedMemoryFact|governedMemoryDecision|governedMemorySource)\.create\(/);
});

test("assistant validation forwards its stable request key before each creation attempt", () => {
  const start = assistant.indexOf("function validateAndCreate()");
  const validation = assistant.slice(start, assistant.indexOf("\n  return (", start));
  assert.match(validation, /formData\.set\("requestKey", requestKey\)/);
  assert.ok(validation.indexOf('formData.set("requestKey", requestKey)') < validation.indexOf("createGovernedJourneyAction(formData)"));
  assert.doesNotMatch(validation, /randomUUID|crypto\.randomUUID|randomBytes/);
  assert.equal((validation.match(/formData\.set\("requestKey", requestKey\)/g) ?? []).length, 1);
});
