ALTER TABLE regulation_cache
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS display_status TEXT,
  ADD COLUMN IF NOT EXISTS display_restriction TEXT,
  ADD COLUMN IF NOT EXISTS quality_flag TEXT;

CREATE INDEX IF NOT EXISTS idx_regulation_cache_quality_flag
  ON regulation_cache (quality_flag);

CREATE INDEX IF NOT EXISTS idx_regulation_cache_display_name
  ON regulation_cache (display_name);
