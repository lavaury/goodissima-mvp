import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../lib/events/humanize.ts", import.meta.url), "utf8");
const expectedSnippets = [
  "Matching relationnel active",
  "Matching relationnel desactive",
  "Correspondance relationnelle proposee",
  "Analyse semantique des correspondances effectuee",
  "Brouillon IA utilise",
  "Suggestion IA de timeline acceptee",
  "Analyse IA des signaux de confiance effectuee",
  "Message envoye",
  "Demande de document",
  "Evenement enregistre dans l'historique du dossier.",
  "Suggestion IA validee",
  "Suggestion IA creee",
  "Demande de mise en relation",
  "category:",
  "icon:",
];

let failures = 0;

for (const snippet of expectedSnippets) {
  if (source.includes(snippet)) {
    console.log(`PASS mapping contains: ${snippet}`);
  } else {
    failures += 1;
    console.error(`FAIL missing mapping snippet: ${snippet}`);
  }
}

if (/title:\s*""/.test(source)) {
  failures += 1;
  console.error("FAIL empty title detected");
} else {
  console.log("PASS no empty title literal detected");
}

if (failures > 0) {
  console.error(`\nEvent humanize QA failed: ${failures} issue(s).`);
  process.exit(1);
}

console.log("\nEvent humanize QA passed.");
