import fs from "node:fs";

function assert(condition, message) {
  if (!condition) {
    console.error(`[qa:ui-polish] ${message}`);
    process.exit(1);
  }
}

const aiWorkspace = fs.readFileSync("components/AIWorkspace.tsx", "utf8");
const chatBox = fs.readFileSync("components/ChatBox.tsx", "utf8");
const caseWorkspace = fs.readFileSync("components/RelationCaseWorkspace.tsx", "utf8");
const matchingPanel = fs.readFileSync("components/MatchingPanel.tsx", "utf8");

for (const token of ["#2f3437", "#2fb8c4", "#fbf7f1"]) {
  assert(
    aiWorkspace.includes(token) || chatBox.includes(token) || caseWorkspace.includes(token) || matchingPanel.includes(token),
    `premium palette token missing: ${token}`,
  );
}

assert(aiWorkspace.includes("AIWorkspaceIcon"), "AI tabs must include icons");
assert(aiWorkspace.includes("aria-selected"), "AI tabs must keep accessible tab state");
assert(aiWorkspace.includes("aria-expanded"), "mobile AI drawer must expose expanded state");
assert(aiWorkspace.includes("sticky top-0"), "AI tabs/header must remain sticky");
assert(chatBox.includes('data-sticky-input="true"'), "conversation input must remain sticky bottom");
assert(caseWorkspace.includes("humanizeAIEvent"), "audit events must be humanized");
assert(caseWorkspace.includes('debugMode && senderType === "OWNER"'), "raw audit diagnostics must stay owner-debug-only");
assert(caseWorkspace.includes("Code audit: {log.eventType}"), "owner debug audit diagnostic is missing");
assert(matchingPanel.includes("sans score visible"), "matching must keep no-score visible guarantee");
assert(matchingPanel.includes("Clarifications"), "matching clarifications must remain visible");

console.info("[qa:ui-polish] Premium UX polish checks passed");
