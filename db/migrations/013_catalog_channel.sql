-- Sales channel whose price the catalog pulls: retail (walk-in, cust_group_2
-- 10101) or wholesale (cust_group_2 10201).
ALTER TABLE odg_pm_catalog
  ADD COLUMN IF NOT EXISTS price_channel varchar(12) NOT NULL DEFAULT 'retail'
  CHECK (price_channel IN ('retail', 'wholesale'));
