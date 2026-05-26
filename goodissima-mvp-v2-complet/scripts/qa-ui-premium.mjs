import fs from "node:fs";

function assert(condition, message) {
  if (!condition) {
    console.error(`[qa:ui-premium] ${message}`);
    process.exit(1);
  }
}

const files = {
  aiWorkspace: fs.readFileSync("components/AIWorkspace.tsx", "utf8"),
  emptyState: fs.readFileSync("components/AIEmptyState.tsx", "utf8"),
  chatBox: fs.readFileSync("components/ChatBox.tsx", "utf8"),
  matching: fs.readFileSync("components/MatchingPanel.tsx", "utf8"),
  relationCase: fs.readFileSync("components/RelationCaseWorkspace.tsx", "utf8"),
  roadmap: fs.readFileSync("docs/matching-governance/MATCHING_GOVERNANCE.md", "utf8"),
};

assert(files.emptyState.includes('data-ai-empty-state="true"'), "premium AI empty state marker missing");
assert(files.aiWorkspace.includes("transition-all duration-200"), "AI tab transition missing");
assert(files.aiWorkspace.includes("shadow-[0_6px_18px_rgba(47,184,196,0.14)]"), "active tab cyan glow missing");
assert(files.chatBox.includes("SendIcon"), "send button icon missing");
assert(files.chatBox.includes('data-sticky-input="true"'), "sticky input marker missing");
assert(files.chatBox.includes("rounded-[1.55rem]"), "conversation bubble radius polish missing");
assert(files.matching.includes("Privacy-first"), "matching privacy badge missing");
assert(files.matching.includes("AIEmptyState"), "matching empty state missing");
assert(files.relationCase.includes("px-2.5 py-2 text-xs"), "activity feed compaction missing");
assert(files.roadmap.includes("Next.js migration roadmap"), "Next.js migration roadmap missing");
assert(files.roadmap.includes("https://nextjs.org/support-policy"), "Next.js support policy source missing");
assert(files.roadmap.includes("Aucune migration framework n'est lancee"), "roadmap must not imply immediate migration");

console.info("[qa:ui-premium] Final premium UX checks passed");
