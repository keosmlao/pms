-- Print layout template for the catalog PDF: grid | list | showcase | pricelist.
ALTER TABLE odg_pm_catalog
  ADD COLUMN IF NOT EXISTS template varchar(16) NOT NULL DEFAULT 'grid'
  CHECK (template IN ('grid', 'list', 'showcase', 'pricelist'));

ALTER TABLE odg_pm_catalog
  ADD COLUMN IF NOT EXISTS accent varchar(12) NOT NULL DEFAULT 'teal';
