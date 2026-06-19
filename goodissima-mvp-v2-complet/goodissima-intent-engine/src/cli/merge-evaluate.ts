import { readFile } from "node:fs/promises";
import type { CiroRecord } from "../ciro/model.js";
import { validateCiro } from "../ciro/validator.js";
import { evaluateMerge } from "../merge/candidate-evaluator.js";
import { fail, parseArguments, writeJson } from "./shared.js";

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

function requireCiro(value: unknown, label: string): CiroRecord {
  const validation = validateCiro(value);
  if (!validation.valid) throw new Error(`${label} is not a valid CIRO: ${validation.issues[0].message}`);
  return validation.value;
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2));
  if (!args.source) throw new Error("--source is required.");
  if (!args.candidates) throw new Error("--candidates is required.");
  const source = requireCiro(await readJson(args.source), "Source fixture");
  const candidateInput = await readJson(args.candidates);
  if (!Array.isArray(candidateInput)) throw new Error("Candidates fixture must be a JSON array of CIRO records.");
  const candidates = candidateInput.map((candidate, index) => requireCiro(candidate, `Candidate fixture ${index}`));
  await writeJson(evaluateMerge(source, candidates, { filterNoMatch: args.filterNoMatch }), args.output);
}

main().catch(fail);
