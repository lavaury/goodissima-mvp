import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const repositoryPath = new URL("../lib/governed-journey/read/repository.ts", import.meta.url);
const servicePath = new URL("../lib/governed-journey/read/service.ts", import.meta.url);

test("GJ-4 uses a bounded descending keyset read and an ordered event read", async () => {
  const [repository, service] = await Promise.all([readFile(repositoryPath, "utf8"), readFile(servicePath, "utf8")]);
  assert.match(repository, /updatedAt: "desc"/);
  assert.match(repository, /id: "desc"/);
  assert.match(repository, /take: input\.limit \+ 1/);
  assert.match(repository, /orderBy: \{ sequence: "asc" \}/);
  assert.match(repository, /isolationLevel: "RepeatableRead"/);
  assert.match(service, /input\.limit \?\? 20/);
  assert.match(service, /limit > 50/);
  assert.match(service, /visibleMemorySourceCount: null/);
});
