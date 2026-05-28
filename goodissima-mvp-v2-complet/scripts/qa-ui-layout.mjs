import fs from "node:fs";

function assert(condition, message) {
  if (!condition) {
    console.error(`[qa:ui-layout] ${message}`);
    process.exit(1);
  }
}

const workspace = fs.readFileSync("components/AIWorkspace.tsx", "utf8");
const caseWorkspace = fs.readFileSync("components/RelationCaseWorkspace.tsx", "utf8");

for (const label of ["Resume IA", "Timeline IA", "Signaux IA", "Matching", "Brouillons IA"]) {
  assert(workspace.includes(label), `missing AI workspace tab: ${label}`);
}

assert(caseWorkspace.includes('data-case-layout="conversation-ai-sidebar"'), "case page layout marker missing");
assert(caseWorkspace.includes('data-conversation-zone="true"'), "conversation zone marker missing");
assert(caseWorkspace.includes('data-metadata-sidebar="true"'), "metadata sidebar marker missing");
assert(caseWorkspace.includes("<AIWorkspace"), "AIWorkspace is not mounted in RelationCaseWorkspace");

const conversationIndex = caseWorkspace.indexOf('data-conversation-zone="true"');
const aiWorkspaceIndex = caseWorkspace.indexOf("<AIWorkspace");
const sidebarIndex = caseWorkspace.indexOf('data-metadata-sidebar="true"');
assert(conversationIndex < aiWorkspaceIndex, "conversation zone must be before AI workspace");
assert(aiWorkspaceIndex < sidebarIndex, "AI workspace must be before metadata sidebar");

const documentIndex = caseWorkspace.indexOf("<DocumentList");
assert(documentIndex > conversationIndex && documentIndex < aiWorkspaceIndex, "documents must stay close to conversation");

console.info("[qa:ui-layout] AI workspace layout checks passed");
