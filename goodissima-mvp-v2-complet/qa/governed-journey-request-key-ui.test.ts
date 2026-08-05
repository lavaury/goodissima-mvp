import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");
const page = read("app/gouvernance/nouveau/page.tsx");
const assistant = read("app/gouvernance/nouveau/GovernanceJourneyAssistant.tsx");
const action = read("lib/governance-journey-actions.ts");

test("generates two independent request keys during the server page render", () => {
  assert.match(page, /import \{ randomUUID \} from "node:crypto"/);
  assert.match(page, /const manualRequestKey = randomUUID\(\)/);
  assert.match(page, /const assistantRequestKey = randomUUID\(\)/);
  assert.doesNotMatch(page, /owner\.(?:id|email|name).*randomUUID|randomUUID.*owner\.(?:id|email|name)/);
});

test("submits the manual server key through an invisible field", () => {
  assert.match(page, /<form action=\{createGovernedJourneyAction\}[\s\S]*?<input type="hidden" name="requestKey" value=\{manualRequestKey\} \/>/);
  assert.doesNotMatch(page, /value=\{assistantRequestKey\}[^>]*name="requestKey"/);
});

test("passes a distinct server key to the assistant", () => {
  assert.match(page, /<GovernanceJourneyAssistant workspaces=\{workspaces\} initialRequestKey=\{assistantRequestKey\} \/>/);
  assert.doesNotMatch(page, /initialRequestKey=\{manualRequestKey\}/);
});

test("keeps the assistant key stable for retries and content revisions", () => {
  assert.match(assistant, /initialRequestKey: string/);
  assert.match(assistant, /const \[requestKey\] = useState\(initialRequestKey\)/);
  assert.match(assistant, /function validateAndCreate\(\)[\s\S]*?formData\.set\("requestKey", requestKey\)/);
  assert.doesNotMatch(assistant, /randomUUID|crypto\.randomUUID|Date\.now|Math\.random/);
  assert.match(assistant, /onClick=\{\(\) => setProposal\(null\)\}[\s\S]*?Reprendre le besoin/);
});

test("preserves pending protection and the canonical final action", () => {
  assert.match(assistant, /const \[isPending, startTransition\] = useTransition\(\)/);
  assert.match(assistant, /disabled=\{!canCreate\}/);
  assert.match(assistant, /await createGovernedJourneyAction\(formData\)/);
  assert.doesNotMatch(action, /randomUUID|crypto\.randomUUID/);
});

test("does not expose the key or alter guided contracts", () => {
  assert.doesNotMatch(`${page}\n${assistant}`, /Request key|Fingerprint|Clé d['’]idempotence|Idempotency key/i);
  assert.doesNotMatch(`${page}\n${assistant}`, /journeyVersion/);
  assert.match(page, /data-boussole-id="manual-governed-journey-form"/);
  assert.match(assistant, /data-boussole-id="validate-governed-journey"/);
});
