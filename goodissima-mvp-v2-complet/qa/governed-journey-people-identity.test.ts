import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { projectCanonicalJourneyPeople, projectCompactJourneyPeople } from "../lib/governed-journey-people.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const organizer = { id: "user-owner", name: "Admin Staging" };
const participant = (id: string, userId: string | null, displayName: string, userName = displayName) => ({ id, inviteeUserId: userId, displayName, inviteeUser: userId ? { name: userName, email: `${userId}@example.test` } : null });

test("organizer alone is one canonical active person", () => {
  const people = projectCanonicalJourneyPeople({ organizer, participants: [] });
  assert.equal(people.length, 1);
  assert.deepEqual(people[0].qualities, ["ORGANIZER"]);
});

test("organizer and accepted participant with the same User.id become one person", () => {
  const people = projectCanonicalJourneyPeople({ organizer, participants: [participant("inv-owner", organizer.id, "lavauy jean-bernard")] });
  assert.equal(people.length, 1);
  assert.deepEqual(people[0].qualities, ["ORGANIZER", "PARTICIPANT"]);
});

test("published Person name wins consistently for list and role identity", () => {
  const names = new Map([[organizer.id, "lavauy jean-bernard"]]);
  const people = projectCanonicalJourneyPeople({ organizer, participants: [participant("inv-owner", organizer.id, "Admin Staging")], publicNamesByUserId: names });
  assert.equal(people[0].displayName, "lavauy jean-bernard");
  const page = read("app/(connected)/gouvernance/parcours/[id]/pilotage/page.tsx");
  assert.match(page, /publicNamesByUserId\.get\(assignment\.assigneeUser\.id\)/);
});

test("distinct Goodissima participant and external guest remain distinct", () => {
  const people = projectCanonicalJourneyPeople({ organizer, participants: [participant("inv-user", "user-other", "Gert Muller"), participant("inv-guest", null, "Guest") ] });
  assert.equal(people.length, 3);
  assert.equal(people.find(person => person.key === "guest:inv-guest")?.identityVerified, false);
});

test("equal text names with different User ids never merge", () => {
  const people = projectCanonicalJourneyPeople({ organizer, participants: [participant("inv-a", "user-a", "Alex"), participant("inv-b", "user-b", "Alex")] });
  assert.equal(people.filter(person => person.displayName === "Alex").length, 2);
});

test("multiple invitations and business roles do not duplicate one User", () => {
  const people = projectCanonicalJourneyPeople({ organizer, participants: [participant("inv-a", "user-a", "Ada"), participant("inv-b", "user-a", "Ada Alias")] });
  assert.equal(people.filter(person => person.userId === "user-a").length, 1);
  assert.equal(people.length, 2);
});

test("unique counters and compact disclosure scale at 1, 5, 6, 20 and 100", () => {
  for (const count of [1, 5, 6, 20, 100]) {
    const invitations = Array.from({ length: count }, (_, index) => participant(`inv-${index}`, `user-${index}`, `Person ${index}`));
    const people = projectCanonicalJourneyPeople({ organizer, participants: invitations });
    const compact = projectCompactJourneyPeople(people, []);
    assert.equal(compact.totalActive, count + 1);
    assert.equal(compact.visibleActive.length, Math.min(count + 1, 5));
    assert.equal(compact.hasOverflow, count + 1 > 5);
  }
});

test("consent and Meeting RSVP remain separate from identity projection", () => {
  const source = read("lib/governed-journey-people.ts");
  assert.doesNotMatch(source, /governedJourneyConsent|GovernedMeeting|rsvp|RSVP/);
});
