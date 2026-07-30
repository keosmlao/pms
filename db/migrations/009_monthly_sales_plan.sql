-- Monthly sales plan per product. Plan figures are entered here; last-year and
-- this-year actuals are read live from ic_trans_detail (trans_flag 44), not stored.

CREATE TABLE IF NOT EXISTS odg_pm_monthly_plan (
  id          bigserial PRIMARY KEY,
  title       varchar(120) NOT NULL,
  plan_year   int NOT NULL,
  note        text,
  created_by  varchar(50) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS odg_pm_monthly_plan_item (
  id        bigserial PRIMARY KEY,
  plan_id   bigint NOT NULL REFERENCES odg_pm_monthly_plan(id) ON DELETE CASCADE,
  item_code varchar(30) NOT NULL,
  sort      int NOT NULL DEFAULT 0,
  UNIQUE (plan_id, item_code)
);

CREATE INDEX IF NOT EXISTS odg_pm_monthly_plan_item_plan_idx
  ON odg_pm_monthly_plan_item (plan_id);

CREATE TABLE IF NOT EXISTS odg_pm_monthly_plan_cell (
  item_id bigint NOT NULL REFERENCES odg_pm_monthly_plan_item(id) ON DELETE CASCADE,
  month   int NOT NULL CHECK (month BETWEEN 1 AND 12),
  qty     numeric NOT NULL DEFAULT 0,
  PRIMARY KEY (item_id, month)
);
