CREATE TABLE IF NOT EXISTS odg_product_spare_mapping (
  id bigserial PRIMARY KEY,
  product_code varchar(50) NOT NULL,
  spare_code varchar(50) NOT NULL,
  created_by varchar(50) NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT odg_product_spare_mapping_distinct_codes CHECK (product_code <> spare_code),
  CONSTRAINT odg_product_spare_mapping_unique UNIQUE (product_code, spare_code)
);

CREATE INDEX IF NOT EXISTS odg_product_spare_mapping_product_idx
  ON odg_product_spare_mapping (product_code);

CREATE INDEX IF NOT EXISTS odg_product_spare_mapping_spare_idx
  ON odg_product_spare_mapping (spare_code);
