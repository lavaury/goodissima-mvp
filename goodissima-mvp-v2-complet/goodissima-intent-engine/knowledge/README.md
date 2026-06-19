# Knowledge Layer

This directory contains configuration and generated artifacts only. Goodissima
knowledge remains in the existing allow-listed source files referenced by the
manifest.

```text
knowledge/
  manifests/   KAL source allow-lists
  corpus/      generated structural corpus files
  reports/     generated statistics and coverage reports
  benchmarks/  generated detector-free benchmark datasets
  detector/    source-grounded detector expression catalogs
  merge/       compatibility and deterministic scoring governance
  presentation/ French presentation labels
  demos/       governed CIRO demonstration fixtures
```

Generated corpus units preserve source ids and line ranges. They do not add
labels, CIRO expectations, intent classes, or inferred semantics.

The taxonomy and expression manifest are validated independently. Taxonomy
manifest expressions must occur verbatim in their declared allow-listed
sources. The approved intent catalog contains `HOUSING`, `EMPLOYMENT`,
`FREELANCE`, and `SERVICES`. Only `HOUSING` and `EMPLOYMENT` currently have
source-grounded expressions; unsupported intents remain deliberately unmapped.
The manifest currently contains five housing expressions and two employment
expressions.

`detector/mode-catalog.v0.json` is the authority for mode ids and source
provenance. Modes referenced by the taxonomy, expression manifest, or CIRO path
manifest must exist in that catalog.

Merge scoring is configuration-driven. Relationship compatibility comes only
from the explicit matrix; role, trust, and family dimensions use exact CIRO
value equality with equal binary unit scores. Every rule retains corpus provenance and every matrix entry has
benchmark coverage. Pair discovery and matching are not implemented.
