# COCHING-WORKFLOW Integration

## Overview

`E:\COCHING-WORKFLOW` produces and updates shared database tables.

`E:\MyLab-Studio` consumes those tables through `server/index.js` and exposes them to the UI.

MyLab also owns a separate set of app-local tables for verification mode and cache writes.

## Producer -> Consumer Map

### Workflow-owned shared tables

- `ingredient_master`
  - Producer: workflow crawlers and batch classification jobs
  - MyLab reads:
    - ingredient list and search
    - ingredient detail
    - purpose gate fallback
    - similar product matching

- `ingredient_properties`
  - Producer: workflow enrichment
  - MyLab reads ingredient detail payloads

- `ingredient_functions`
  - Producer: workflow enrichment
  - MyLab reads ingredient detail payloads

- `regulation_cache`
  - Producer: regulation and safety workflows
  - MyLab reads:
    - regulation list pages
    - ingredient regulation badges
    - formula validation
    - market restriction checks

- `coching_knowledge_base`
  - Producer: workflow knowledge ingestion
  - MyLab reads:
    - KPI stats
    - ingredient regulation detail
    - regulation validation helpers

- `product_master`
  - Producer: product collection workflows
  - MyLab reads:
    - product list
    - autocomplete
    - product detail
    - similar product matching
    - copy-formula flow

- `product_ingredients`
  - Producer: product ingredient expansion
  - MyLab references the domain indirectly in product analysis flows

- `compound_master`
  - Producer: compound expansion workflow
  - MyLab reads the cache used by AI formulation helpers

- `guide_cache`
  - Producer: workflow guide-formula generation
  - MyLab reads:
    - guide formula list/detail
    - RAG seed lookup for AI formulation
  - MyLab also writes:
    - AI-generated formulas cached back into `guide_cache`

- `guide_cache_copy`
  - Producer: workflow copy-formula generation
  - MyLab reads:
    - copy formula list/detail
    - RAG seed fallback

- `collection_progress`
  - Producer: workflow ingestion jobs
  - MyLab reads collection status dashboards

- `stability_tests`
  - Producer: shared DB data entry / upstream workflow
  - MyLab reads stability dashboards and tables

### MyLab-owned tables

- `uploaded_formulations`
- `verification_reports`
- `formulation_notes`
- `verified_formulation_pool`
- `llm_cache`
- `product_categories`
- `purpose_ingredient_map`
- `compatibility_rules`

These are created or maintained by `E:\MyLab-Studio\server\index.js`.

## Important Schema Notes

### `guide_cache_copy.estimated_ph`

- Workflow reports indicate this value can now be text, not only numeric.
- MyLab now normalizes formula cache API responses so `estimated_ph` is returned as a string-safe value.

### `regulation_cache.restriction`

- Older rows may store plain text.
- Newer workflow sources can store structured JSON.
- MyLab now parses both forms when building regulation responses and verification checks.
- Recommended future workflow columns are documented in `docs/REGULATION_CACHE_STANDARD.md`.
- Workflow rollout targets and SQL migration draft are documented in:
  - `docs/WORKFLOW_REGULATION_ROLLOUT.md`
  - `docs/sql/regulation_cache_display_columns.sql`

### New `regulation_cache.source` values

Observed workflow-facing sources include:

- `MFDS_SEED`
- `GEMINI_KR`
- `GEMINI_EU`
- `GEMINI_US`
- `GEMINI_SAFETY`
- `REG_MONITOR_US`

If workflow adds more structured sources, MyLab display mapping should be updated in:

- `src/utils/regulationSource.js`
- `server/index.js`

## High-risk Integration Points

- Verification mode depends on `regulation_cache` being queryable by either `ingredient` or `inci_name`.
- Formula cache views depend on `guide_cache` and `guide_cache_copy` column names staying stable.
- RAG helper behavior depends on `wt_valid` semantics in both cache tables.
- Workflow repair scripts under `E:\COCHING-WORKFLOW\scripts\fix` appear to have mixed quality; do not assume every script there is runnable without validation.

## Recommended Change Process

When workflow changes shared DB schema:

1. Update the workflow report in `E:\COCHING-WORKFLOW\reports`.
2. Verify the produced column types in the real DB.
3. Check MyLab server queries touching the changed table.
4. Update `src/utils/regulationSource.js` if new regulation sources were added.
5. Run MyLab build and a short API startup check.
