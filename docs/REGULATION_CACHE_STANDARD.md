# Regulation Cache Standard

## Goal

`regulation_cache` should store two kinds of values:

- raw collection output for traceability
- normalized display fields for product-facing UI

MyLab should prefer normalized display fields when they exist.

## Recommended Columns

Add these columns to `regulation_cache` in `E:\COCHING-WORKFLOW`:

- `display_name TEXT`
- `display_status TEXT`
- `display_restriction TEXT`
- `quality_flag TEXT`

Suggested meaning:

- `display_name`
  - canonical INCI-like label for UI
- `display_status`
  - one of `banned`, `restricted`, `allowed`, `monitor`, `unknown`
- `display_restriction`
  - short user-facing text like `금지`, `최대 0.5%`, `별도 제한 없음`
- `quality_flag`
  - one of `valid`, `invalid`, `needs_review`

## Storage Rules

Save to `regulation_cache` only when the ingredient can be normalized to a meaningful display name.

Treat these as invalid for the main table:

- leading punctuation placeholders like `-[2]`
- unresolved numeric fragments like `-92`
- CAS-only labels in the ingredient name field
- strings that mean lookup failure
  - `invalid ingredient`
  - `unknown`
  - `not found`
  - `유효하지 않은 원료명`
  - `찾을 수 없습니다`

Recommended handling for invalid rows:

- do not insert into the main user-facing `regulation_cache`, or
- insert with `quality_flag = 'invalid'` and route them out of MyLab widgets

## Display Rules

Normalize UI-facing text before save:

- `allowed` -> `별도 제한 없음`
- `Annex null — allowed` -> `별도 제한 없음`
- `banned` -> `금지`
- `restricted` with known max concentration -> `최대 n%`

For the best result, avoid passing raw workflow phrases directly into the product UI.

## Suggested Workflow Split

Use two outputs instead of one:

1. `regulation_cache`
   - valid rows only
   - contains normalized display fields
2. `regulation_cache_errors` or equivalent
   - invalid lookup cases
   - raw prompt/input/output for debugging

## Suggested SQL Migration

```sql
ALTER TABLE regulation_cache
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS display_status TEXT,
  ADD COLUMN IF NOT EXISTS display_restriction TEXT,
  ADD COLUMN IF NOT EXISTS quality_flag TEXT;
```

## MyLab Compatibility

MyLab already supports these columns when present:

- `display_name`
- `display_status`
- `display_restriction`
- `quality_flag`

Fallback behavior still works for older rows, but the best widget quality comes from normalized workflow writes.

## Validation Checklist

Before publishing workflow output:

1. `display_name` must not start with `-`
2. `display_name` must not be numeric-only
3. `quality_flag` must be set
4. `display_status` must be from the allowed status set
5. `display_restriction` must be short, user-facing, and non-debug text
