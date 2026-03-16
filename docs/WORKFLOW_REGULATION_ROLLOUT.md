# Workflow Regulation Rollout

## Scope

This rollout is for `E:\COCHING-WORKFLOW` so that `regulation_cache` produces high-quality records for MyLab.

## Primary Targets

- `E:\COCHING-WORKFLOW\scripts\batch\batch_safety.py`
- `E:\COCHING-WORKFLOW\scripts\batch\batch_regulation.py`
- `E:\COCHING-WORKFLOW\scripts\deploy\deploy_new_workflows.py`

## Why These Files

- `batch_safety.py`
  - writes `GEMINI_SAFETY_*` rows directly into `regulation_cache`
  - currently inserts raw `inci` into both `ingredient` and `inci_name`
- `batch_regulation.py`
  - writes `REG_MONITOR_*` rows
  - currently allows summary text fallback rows into `ingredient`
- `deploy_new_workflows.py`
  - generates the n8n workflow SQL and parser nodes
  - must match the same display-field contract as the batch scripts

## Required DB Migration

Run the SQL in `docs/sql/regulation_cache_display_columns.sql`.

## Required Logic Changes

### 1. Normalize names before save

Add a shared normalization rule in workflow code:

- trim whitespace
- remove leading `-`
- reject numeric-only values
- reject CAS-only values in `ingredient`
- reject obvious lookup-failure text

Recommended outcomes:

- valid normalized value -> save to `display_name`
- invalid or unresolved value -> `quality_flag = 'invalid'`

### 2. Save display columns

Every workflow write into `regulation_cache` should populate:

- `display_name`
- `display_status`
- `display_restriction`
- `quality_flag`

### 3. Keep raw traceability

Preserve raw `restriction` JSON for audit/debug, but do not rely on it for UI display.

### 4. Split invalid rows

Best option:

- insert invalid rows into `regulation_cache_errors`

Acceptable short-term option:

- insert invalid rows into `regulation_cache` with `quality_flag = 'invalid'`

MyLab already hides invalid rows from the widget.

## File-by-File Change Notes

### `batch_safety.py`

Current write block:

- source: `GEMINI_SAFETY_KR/EU/US/JP/CN`
- query inserts only `source, ingredient, inci_name, max_concentration, restriction, updated_at`

Change needed:

- compute `display_name` from normalized INCI
- compute `display_status` from `reg.status`
- compute `display_restriction`
  - `allowed` -> `별도 제한 없음`
  - `restricted` + max concentration -> `최대 n`
  - `banned` -> `금지`
- compute `quality_flag`

Reject examples:

- `-[2]`
- `-92`
- `68332-79-6`
- `482-`

### `batch_regulation.py`

Current issue:

- if no ingredient is extracted, the summary/title is saved into `ingredient`

Change needed:

- do not save summary text into `ingredient` for main table rows
- if `affected_ingredients` is empty:
  - save to error table, or
  - save with `quality_flag = 'needs_review'`

### `deploy_new_workflows.py`

Current issue:

- n8n parser node returns raw values only
- postgres node inserts only the old columns

Change needed:

- parser node should emit:
  - `display_name`
  - `display_status`
  - `display_restriction`
  - `quality_flag`
- postgres node query should insert/update those columns too

## Recommended Quality Rules

### `quality_flag = valid`

- canonical INCI-like text exists
- not numeric-only
- not CAS-only
- not lookup-error text

### `quality_flag = invalid`

- invalid ingredient
- unresolved ingredient
- malformed token
- parser error

### `quality_flag = needs_review`

- source summary exists but ingredient extraction is uncertain
- regulation is real but ingredient mapping is not stable

## Acceptance Criteria

1. New rows have all four display columns populated.
2. `quality_flag = invalid` rows do not appear in MyLab widgets.
3. `display_restriction` is user-facing Korean text.
4. `ingredient` and `display_name` do not contain leading `-`.
5. CAS-only rows are not shown as ingredient names in MyLab.

## MyLab Readiness

MyLab is already ready for this rollout.

It now:

- prefers display columns when present
- hides invalid rows
- exposes `/api/regulations-quality-summary` for sampling and quality checks
