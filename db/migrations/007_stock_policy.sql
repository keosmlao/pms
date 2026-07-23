-- Stock policy (DII target) per BU × brand, with optional supplier detail.
-- Source: "Policy Stock By Bu.xlsx" (brand level, 4 BUs) and
-- "Policy Stock PIPE.xlsx" (supplier detail for PIPE).
-- dii_months = sale_months + stock_months (e.g. 3 = ຂາຍ 1 ເດືອນ + stock 2 ເດືອນ).
-- group_main matches ic_group.code: 11=CE, 12=AIR, 13=PIPE, 14=SPEARPART.
-- brand matches ic_inventory.item_brand (uppercase).

CREATE TABLE IF NOT EXISTS odg_stock_policy (
  id            bigserial PRIMARY KEY,
  group_main    varchar(10) NOT NULL,
  brand         varchar(80) NOT NULL,
  supplier_name varchar(160) NOT NULL DEFAULT '',  -- '' = brand-level policy
  sale_share    numeric,                           -- share of BU sales (info only)
  sale_months   numeric NOT NULL DEFAULT 1,
  stock_months  numeric NOT NULL,
  reason        text,
  updated_by    varchar(50),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_main, brand, supplier_name)
);

CREATE INDEX IF NOT EXISTS odg_stock_policy_group_brand_idx
  ON odg_stock_policy (group_main, brand);
