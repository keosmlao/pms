-- Per-item sales-plan entry granularity: some models are planned week-by-week
-- (fast movers), others as a single monthly figure (slow movers). Cells are
-- always stored weekly; 'month' only changes how the sales plan is entered
-- (one value per 4-week block, distributed evenly across its weeks).

ALTER TABLE odg_pm_weekly_plan_item
  ADD COLUMN IF NOT EXISTS plan_period varchar(5) NOT NULL DEFAULT 'week'
  CHECK (plan_period IN ('week', 'month'));
