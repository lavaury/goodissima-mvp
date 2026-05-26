import fs from "node:fs";

function assert(condition, message) {
  if (!condition) {
    console.error(`[qa:ui-brand] ${message}`);
    process.exit(1);
  }
}

const aiWorkspace = fs.readFileSync("components/AIWorkspace.tsx", "utf8");
const chatBox = fs.readFileSync("components/ChatBox.tsx", "utf8");
const caseWorkspace = fs.readFileSync("components/RelationCaseWorkspace.tsx", "utf8");
const matchingPanel = fs.readFileSync("components/MatchingPanel.tsx", "utf8");
const combined = [aiWorkspace, chatBox, caseWorkspace, matchingPanel].join("\n");

for (const token of ["#2fb8c4", "#247f88", "#2f3437", "#263846", "#fbf7f1"]) {
  assert(combined.includes(token), `Goodissima brand token missing: ${token}`);
}

for (const forbidden of ["#8f7ab8", "#f1edf7", "#ded8e8", "#d9d2e8"]) {
  assert(!combined.includes(forbidden), `legacy lavender token should not drive brand polish: ${forbidden}`);
}

assert(aiWorkspace.includes("Goodissima Intelligence"), "AI Workspace brand label missing");
assert(aiWorkspace.includes("bg-[#2fb8c4]"), "AI Workspace must use cyan brand accent");
assert(aiWorkspace.includes("transition-all duration-200"), "AI tabs need subtle premium transition");
assert(chatBox.includes('data-sticky-input="true"'), "conversation sticky input must be preserved");
assert(matchingPanel.includes("Privacy-first"), "matching privacy-first badge missing");
assert(matchingPanel.includes("NetworkIcon"), "matching network icon missing");

for (const section of ["Matching", "Acces", "Activite recente", "Audit"]) {
  assert(caseWorkspace.includes(section), `sidebar collapsible section missing: ${section}`);
}

console.info("[qa:ui-brand] Goodissima brand UX checks passed");
