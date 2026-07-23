-- Weekly purchase planning (Samsung CE style workbook):
-- sales plan by week → purchase qty = Σ sales plan − stock → arrival plan by week.
-- Items may reference ic_inventory, or be a bare model name for units not yet
-- created in the ERP (e.g. new /UN models).

CREATE TABLE IF NOT EXISTS odg_pm_weekly_plan (
  id            bigserial PRIMARY KEY,
  title         varchar(120) NOT NULL,
  plan_year     int NOT NULL,
  start_week    int NOT NULL,                 -- ISO week of the first plan column
  sale_weeks    int NOT NULL DEFAULT 13,      -- number of sales-plan week columns
  arrival_weeks int NOT NULL DEFAULT 13,      -- number of arrival-plan week columns
  status        varchar(12) NOT NULL DEFAULT 'draft',  -- draft | confirmed
  note          text,
  created_by    varchar(50) NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS odg_pm_weekly_plan_item (
  id         bigserial PRIMARY KEY,
  plan_id    bigint NOT NULL REFERENCES odg_pm_weekly_plan(id) ON DELETE CASCADE,
  item_code  varchar(30),                     -- NULL when the model is not in ic_inventory yet
  model      varchar(80) NOT NULL,            -- model label shown in the grid
  grp        varchar(30) NOT NULL DEFAULT '', -- product group, e.g. REF / WM
  stock_qty  numeric NOT NULL DEFAULT 0,      -- stock snapshot at add/refresh time
  sort       int NOT NULL DEFAULT 0,
  UNIQUE (plan_id, model)
);

CREATE INDEX IF NOT EXISTS odg_pm_weekly_plan_item_plan_idx
  ON odg_pm_weekly_plan_item (plan_id);

CREATE TABLE IF NOT EXISTS odg_pm_weekly_plan_cell (
  item_id  bigint NOT NULL REFERENCES odg_pm_weekly_plan_item(id) ON DELETE CASCADE,
  kind     varchar(8) NOT NULL CHECK (kind IN ('sale', 'arrival')),
  week_no  int NOT NULL,                      -- absolute week index from start_week (may exceed 52)
  qty      numeric NOT NULL DEFAULT 0,
  PRIMARY KEY (item_id, kind, week_no)
);
