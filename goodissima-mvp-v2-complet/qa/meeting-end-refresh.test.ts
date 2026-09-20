import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const mediaRoom = readFileSync(new URL("../components/media/GoodissimaMediaRoom.tsx", import.meta.url), "utf8");
const wrapper = readFileSync(new URL("../components/RelationLiveKitMediaRoom.tsx", import.meta.url), "utf8");
const ownerPage = readFileSync(new URL("../app/(connected)/gouvernance/parcours/[id]/reunions/[meetingId]/page.tsx", import.meta.url), "utf8");
const guestPage = readFileSync(new URL("../app/gouvernance/invitation/[token]/reunions/[meetingId]/page.tsx", import.meta.url), "utf8");
const endpoint = readFileSync(new URL("../app/api/gouvernance/parcours/[id]/media/end/route.ts", import.meta.url), "utf8");

test("la terminaison attend le succès serveur avant de couper la salle locale", () => {
  assert.match(endpoint, /status: "COMPLETED", accessOpened: false/);
  assert.match(endpoint, /deleteRoom/);
  assert.match(endpoint, /revalidatePath/);
  assert.doesNotMatch(endpoint, /updatedAt|completedAt/);
  assert.doesNotMatch(endpoint, /data: \{ status: "COMPLETED", accessOpened: false, note:/);
  assert.ok(endpoint.indexOf('status: "COMPLETED"') < endpoint.indexOf("deleteRoom"));
  assert.ok(mediaRoom.indexOf("if (!response.ok)") < mediaRoom.indexOf("disconnectLocalRoom();", mediaRoom.indexOf("async function end")));
});

test("après succès les tracks sont nettoyés puis le cockpit est remplacé et rafraîchi", () => {
  assert.match(mediaRoom, /trackPublications\.values\(\)/);
  assert.match(mediaRoom, /publication\.track\?\.stop\(\)/);
  assert.match(mediaRoom, /room\.disconnect\(\)/);
  assert.match(mediaRoom, /onEnded\?\.\(\)/);
  assert.match(wrapper, /router\.replace\(returnHref\); router\.refresh\(\)/);
  assert.match(ownerPage, /returnHref=\{`\/gouvernance\/parcours\/\$\{params\.id\}\/pilotage#meeting-\$\{meeting\.id\}`\}/);
});

test("double clic et échec restent sûrs et Quitter ne termine pas", () => {
  assert.match(mediaRoom, /pending \|\| ending/);
  assert.match(mediaRoom, /disabled=\{pending \|\| ending\}/);
  assert.match(mediaRoom, /Terminaison…/);
  assert.match(mediaRoom, /Vous pouvez réessayer/);
  const leaveBody = mediaRoom.slice(mediaRoom.indexOf("async function leave"), mediaRoom.indexOf("async function end"));
  assert.doesNotMatch(leaveBody, /endEndpoint|COMPLETED|onEnded/);
});

test("ROOM_DELETED informe les autres participants et leur propose le retour", () => {
  assert.match(mediaRoom, /DisconnectReason\.ROOM_DELETED/);
  assert.match(mediaRoom, /La réunion a été terminée par l’organisateur/);
  assert.match(mediaRoom, /Retour au Parcours/);
  assert.match(guestPage, /returnHref=\{`\/gouvernance\/invitation\/\$\{params\.token\}`\}/);
});

test("un nouveau token reste refusé après COMPLETED", () => {
  const tokenRoute = readFileSync(new URL("../app/api/gouvernance/invitations/[id]/media/livekit-token/route.ts", import.meta.url), "utf8");
  assert.match(tokenRoute, /status: "REQUESTED"/);
  assert.doesNotMatch(tokenRoute, /status: \{ in: \["REQUESTED", "COMPLETED"\]/);
});
