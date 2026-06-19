import { readFile } from "node:fs/promises";

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

export function loadCompatibilityMatrix(filePath: string) {
  return readJson<import("./types.js").CompatibilityMatrix>(filePath);
}

export function loadScoringRules(filePath: string) {
  return readJson<import("./types.js").ScoringRules>(filePath);
}

export function loadMergeBenchmark(filePath: string) {
  return readJson<import("./types.js").MergeBenchmark>(filePath);
}
