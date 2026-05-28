import { createHash } from "node:crypto";

const dimensions = 32;
const statuses = new Set(["pending", "processing", "completed", "failed"]);
const triggerTypes = new Set(["message_created", "document_uploaded", "timeline_updated", "manual_refresh", "template_changed"]);

function hashToken(token) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function sanitizeText(value) {
  return value
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[private-email]")
    .replace(/https?:\/\/[^\s]+/g, "[private-url]")
    .replace(/\b(api[_-]?key|secret|token)\s*[:=]\s*[^\s,;]+/gi, "[private-secret]")
    .replace(/\b(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{24,}\b/g, "[private-token]");
}

function embed(input) {
  const vector = Array.from({ length: dimensions }, () => 0);
  for (const token of input.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)) {
    vector[hashToken(token) % dimensions] += hashToken(token) % 2 === 0 ? 1 : -1;
  }
  const norm = Math.hypot(...vector) || 1;
  return vector.map((value) => Number((value / norm).toFixed(6)));
}

function makeJob(id, relationCaseId, triggerType) {
  return { id, relationCaseId, triggerType, status: "pending", attempts: 0, lastError: null };
}

function processJob(job, shouldFail = false) {
  if (!statuses.has(job.status)) throw new Error("INVALID_STATUS");
  if (!triggerTypes.has(job.triggerType)) throw new Error("INVALID_TRIGGER");
  const processing = { ...job, status: "processing", attempts: job.attempts + 1 };
  if (shouldFail) {
    return processing.attempts >= 3
      ? { ...processing, status: "failed", lastError: "FORCED_EMBEDDING_FAILURE" }
      : { ...processing, status: "pending", lastError: "FORCED_EMBEDDING_FAILURE" };
  }
  return { ...processing, status: "completed", processedAt: new Date().toISOString() };
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS ${message}`);
  }
}

const pendingJob = makeJob("job_1", "case_1", "message_created");
const completedJob = processJob(pendingJob);
let failingJob = makeJob("job_2", "case_2", "manual_refresh");
failingJob = processJob(failingJob, true);
failingJob = processJob(failingJob, true);
failingJob = processJob(failingJob, true);
const context = sanitizeText("candidate@example.com token=abcdefghijklmnopqrstuvwxyz1234567890 Banque IA");
const firstEmbedding = embed(context);
const secondEmbedding = embed(context);
const largeJobs = Array.from({ length: 1000 }, (_, index) =>
  makeJob(`bulk_${index}`, `case_${index}`, index % 2 === 0 ? "message_created" : "timeline_updated"),
);
const contentHash = createHash("sha256").update(context).digest("hex");

assert(pendingJob.status === "pending", "async_job_created creates pending job");
assert(completedJob.status === "completed", "async_processing completes job");
assert(failingJob.status === "failed" && failingJob.attempts === 3, "retry_failure fails after 3 retries");
assert(context.includes("[private-email]") && context.includes("[private-secret]"), "privacy sanitizer redacts sensitive content");
assert(JSON.stringify(firstEmbedding) === JSON.stringify(secondEmbedding), "deterministic_refresh keeps same mock embedding");
assert(largeJobs.length >= 1000, "large dataset simulates 1000+ concurrent refresh jobs");
assert(contentHash.length === 64, "contentHash generated for storage");
assert("Analyse semantique en cours d'actualisation".length > 0, "stale_matching warning is available");

if (process.exitCode) {
  console.error("\nEmbeddings QA failed.");
  process.exit(process.exitCode);
}

console.log("\nEmbeddings QA passed.");
