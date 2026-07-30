-- Product catalog / brochure (ແຄັດຕາລ໊ອກ). A curated set of products with a
-- display price and short spec, for salespeople to show customers.

CREATE TABLE IF NOT EXISTS odg_pm_catalog (
  id            bigserial PRIMARY KEY,
  title         varchar(140) NOT NULL,
  subtitle      varchar(200) NOT NULL DEFAULT '',
  currency_code varchar(2) NOT NULL DEFAULT '02',
  columns       int NOT NULL DEFAULT 3,          -- cards per row in the print view (2-4)
  show_price    boolean NOT NULL DEFAULT true,
  created_by    varchar(50) NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS odg_pm_catalog_item (
  id         bigserial PRIMARY KEY,
  catalog_id bigint NOT NULL REFERENCES odg_pm_catalog(id) ON DELETE CASCADE,
  item_code  varchar(30) NOT NULL DEFAULT '',
  name       varchar(200) NOT NULL,
  unit       varchar(40) NOT NULL DEFAULT '',
  price      numeric NOT NULL DEFAULT 0,
  spec       varchar(300) NOT NULL DEFAULT '',
  sort       int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS odg_pm_catalog_item_cat_idx
  ON odg_pm_catalog_item (catalog_id);
