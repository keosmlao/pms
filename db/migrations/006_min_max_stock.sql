-- Add maximum stock to the existing per-item stock threshold table.
-- min_qty (reorder point) already exists; max_qty (upper bound) defines the
-- top of the reorder band so purchasing above it can be flagged / prevented.
-- Both columns are nullable: a setting may define min only, max only, or both.

ALTER TABLE odg_min_stock_setting
  ADD COLUMN IF NOT EXISTS max_qty numeric;

-- Guard: when both are set, max must be >= min (skip rows already violating).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
     WHERE constraint_name = 'odg_min_stock_setting_min_le_max'
  ) THEN
    BEGIN
      ALTER TABLE odg_min_stock_setting
        ADD CONSTRAINT odg_min_stock_setting_min_le_max
        CHECK (max_qty IS NULL OR min_qty IS NULL OR max_qty >= min_qty) NOT VALID;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;
