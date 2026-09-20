import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const room = read("components/media/GoodissimaMediaRoom.tsx");
const adapter = read("components/RelationLiveKitMediaRoom.tsx");
const cockpit = read(
  "app/(connected)/gouvernance/parcours/[id]/pilotage/page.tsx",
);
const ownerPage = read(
  "app/(connected)/gouvernance/parcours/[id]/reunions/[meetingId]/page.tsx",
);
const guestPage = read(
  "app/gouvernance/invitation/[token]/reunions/[meetingId]/page.tsx",
);

test("the reusable media room depends only on capabilities", () => {
  for (const businessType of [
    "GovernedJourney",
    "JourneyConsent",
    "MeetingRsvp",
    "Opportunity",
    "SimpleLink",
  ])
    assert.doesNotMatch(room, new RegExp(businessType));
  assert.match(adapter, /capabilities=\{\{/);
  assert.match(adapter, /canJoin: available/);
  assert.match(adapter, /canEnd: actorKind === "owner"/);
});

test("prejoin media stays opt-in and offers local background processing", () => {
  assert.match(room, /Aucun média ne démarre sans votre action/);
  assert.doesNotMatch(room, /useEffect\([\s\S]{0,300}createLocalVideoTrack/);
  assert.match(room, /BackgroundBlur/);
  assert.match(room, /VirtualBackground/);
  assert.match(room, /URL\.createObjectURL/);
  assert.match(room, /traités localement/);
  assert.match(
    room,
    /Le flou d’arrière-plan n’est pas disponible sur cet appareil/,
  );
});

test("meeting UI is dedicated, multiparty, responsive and accessible", () => {
  assert.match(cockpit, /\/reunions\/\$\{session\.id\}/);
  assert.doesNotMatch(cockpit, /<RelationLiveKitMediaRoom/);
  assert.match(ownerPage, /RelationLiveKitMediaRoom/);
  assert.match(guestPage, /hasCurrentMeetingMediaAccess/);
  for (const behavior of [
    "ActiveSpeakersChanged",
    "setScreenShareEnabled",
    "Participants présents",
    "Quitter",
    "Terminer la réunion",
    "aria-label",
  ])
    assert.match(room, new RegExp(behavior));
  assert.match(room, /sm:grid-cols-2 xl:grid-cols-3/);
});
