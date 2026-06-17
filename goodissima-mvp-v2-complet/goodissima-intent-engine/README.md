# goodissima-intent-engine

Initial, detector-free foundations for a Goodissima intent engine.

## Scope

- versioned CIRO data model;
- filesystem Knowledge Access Layer restricted to an explicit manifest;
- structural corpus loader and source-consistency validator;
- corpus statistics and coverage reports;
- detector-free benchmark generation from validated corpus units;
- deterministic source-expression detector v0 returning ranked candidates;
- structural and provenance validator for CIRO records;
- benchmark runner skeleton with no intent detector implementation.

CIRO is intentionally represented as the opaque keys `c`, `i`, `r`, and `o`.
The supplied Goodissima knowledge files do not define the acronym or assign
semantics to its parts, so this package does not invent them.

## Commands

```bash
npm install
npm test
npm run corpus:load -- --output knowledge/corpus/goodissima.corpus.json
npm run corpus:validate -- --corpus knowledge/corpus/goodissima.corpus.json
npm run corpus:stats -- --corpus knowledge/corpus/goodissima.corpus.json
npm run corpus:coverage -- --corpus knowledge/corpus/goodissima.corpus.json
npm run benchmark:generate -- --corpus knowledge/corpus/goodissima.corpus.json --output knowledge/benchmarks/goodissima.generated.json
npm run benchmark -- knowledge/benchmarks/goodissima.generated.json
npm run detect -- --input "AI_TEST_MODE=scenario"
npm run benchmark:detect -- --benchmark knowledge/benchmarks/goodissima.generated.json
npm run ciro:build -- --input "rechercher un dossier locataire"
npm run benchmark:ciro -- --benchmark knowledge/benchmarks/ciro.v0.json
npm run resolve -- --input "rechercher recrutement"
npm run resolve -- --input "rechercher recrutement" --trace
npm run quality
npm run quality -- --format text
npm run merge:governance
npm run benchmark:merge
npm run merge:evaluate -- --source test/fixtures/merge/source.ciro.json --candidates test/fixtures/merge/candidates.ciro.json
npm run merge:evaluate -- --source test/fixtures/merge/source.ciro.json --candidates test/fixtures/merge/candidates.ciro.json --filter-no-match
npm run demo:merge:housing
npm run demo:merge:employment
npm run demo
```

The benchmark command validates and loads a dataset, then reports cases as
`skipped` until a benchmark subject is supplied by a future detector package.

## Knowledge boundary

`knowledge/manifests/goodissima.manifest.json` is the allow-list. The filesystem adapter
will only return files declared in that manifest and rejects paths outside the
configured knowledge root.

All corpus commands emit JSON to stdout unless `--output` is provided. The
statistics, coverage, and benchmark generator commands can load directly from
the manifest when `--corpus` is omitted.

Detector v0 does not produce CIRO. Candidate labels come from
`knowledge/detector/intent-taxonomy.v0.json`, while matching expressions come
from `knowledge/detector/expression-manifest.v0.json`. Both are validated
against the loaded corpus before detection. The approved catalog contains
`HOUSING`, `EMPLOYMENT`, `FREELANCE`, and `SERVICES`. Existing source documents
currently support expressions for `HOUSING` and `EMPLOYMENT` only, so the other
two intents remain unmapped rather than inferred.

CIRO v0 supports six explicit paths across `PROPERTY_RENTAL`, `HOUSING`, and
`EMPLOYMENT`, using `SEARCH` or `DOCUMENT_REQUEST` only where declared in
`knowledge/ciro/paths.v0.json`. Role, relationship, and opaque `c/i/r/o`
values are loaded from that mapping. Missing or ambiguous paths return no CIRO.
Builder startup also runs path governance: approved intent and mode checks,
source grounding, benchmark coverage, and structural CIRO validation.

`resolveIntent(text, builder)` returns detector candidates and either a governed
CIRO or a fail-closed status: `NO_MATCH`, `MULTIPLE_MATCHES`, `UNMAPPED_PATH`,
or `INVALID_CIRO`. `createResolveIntentV0(...)` creates a configured public
resolver after all governance checks pass.
Trace output is opt-in through `{ trace: true }` or CLI `--trace`; compact
responses omit it. The trace reports matched source expressions, candidate
ranking, selected governed path, governance summary, and CIRO validation.

The resolution quality dashboard runs the detector benchmark, CIRO benchmark,
governance checks, and governed resolver over all benchmark inputs. JSON is the
default output; use `--format text` for a readable summary.

Benchmark cases may include `sourceAnnotations`. Each annotation must exactly
match an existing expression-manifest entry and its declared corpus source;
validated expressions are appended deterministically for benchmark execution.

The merge layer exposes `scoreMerge(ciroA, ciroB)`. It scores only explicit
CIRO fields using the governed compatibility matrix and scoring rules. Unknown
relationship pairs fail closed as `NO_MATCH`; there is no text processing,
pair discovery, fallback compatibility, or matching implementation.

`evaluateMerge(sourceCiro, candidateCiros)` scores supplied CIRO candidates and
returns them in descending score order. Equal scores retain input order, and
`{ filterNoMatch: true }` removes only candidates scored as `NO_MATCH`.

The French housing and employment demonstrations load CIRO-only fixtures, evaluate them with
the existing merge scorer, and applies presentation labels afterward. Its
percentages are a direct rendering of the governed score total.
See `demo/README.md` for the French walkthrough and expected output.
