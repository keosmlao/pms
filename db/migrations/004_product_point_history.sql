-- ============================================================================
-- 004_product_point_history.sql
--
-- ປະຫວັດການປ່ຽນທຸງ "ຮ່ວມລາຍການສະສົມແຕ້ມ" ຕໍ່ສິນຄ້າ
--
-- !! ຍັງບໍ່ໄດ້ຣັນ — ສ້າງໄວ້ໃຫ້ກວດກ່ອນ !!
--
-- ເປັນຫຍັງຕ້ອງມີ:
--   ic_inventory_detail.have_point ເປັນ "ສະຖານະປັດຈຸບັນ" ຢ່າງດຽວ ບໍ່ມີປະຫວັດ
--   ຈຶ່ງກວດຍ້ອນຫຼັງບໍ່ໄດ້ວ່າຕອນຂາຍບິນໃດໜຶ່ງ ສິນຄ້ານັ້ນຮ່ວມລາຍການຢູ່ບໍ່
--
--   ດຽວນີ້ພົບ 2,086 ບິນ (ປີ 2026) ທີ່ສິນຄ້າຖືກທຸງວ່າ "ຮ່ວມລາຍການ" ແຕ່ບິນ
--   ໄດ້ 0 ແຕ້ມ ຄິດເປັນຍອດ 14,788 ລ້ານກີບ ≈ 295,767 ແຕ້ມ. ບໍ່ສາມາດສະຫຼຸບໄດ້
--   ວ່າແມ່ນລູກຄ້າເສຍແຕ້ມແທ້ ຫຼື ທຸງຖືກປ່ຽນຫຼັງການຂາຍ — ເພາະບໍ່ມີປະຫວັດ
--
--   ຕາຕະລາງນີ້ເຮັດໃຫ້ຄຳຖາມນັ້ນຕອບໄດ້ໃນອະນາຄົດ
--
-- ໝາຍເຫດ: ic_inventory_detail ເປັນຕາຕະລາງຫຼັກຂອງ ERP — ບໍ່ໄດ້ແກ້ໂຄງສ້າງມັນ
--          ສ້າງຕາຕະລາງປະຫວັດແຍກທີ່ PMS ເປັນເຈົ້າຂອງເອງ
-- ============================================================================

-- ກວດກ່ອນ: ສະຖານະປັດຈຸບັນ (ຄາດ 6,889 ຮ່ວມ / 17,604 ບໍ່ຮ່ວມ)
SELECT have_point, count(*) AS items FROM ic_inventory_detail GROUP BY 1 ORDER BY 1;

-- ແຍກຕາມກຸ່ມສິນຄ້າ
SELECT COALESCE(g.name_1, i.group_main) AS group_name,
       count(*) AS items,
       count(*) FILTER (WHERE d.have_point = 1) AS have_point
  FROM ic_inventory i
  JOIN ic_inventory_detail d ON d.ic_code = i.code
  LEFT JOIN ic_group g ON g.code = i.group_main
 GROUP BY 1 ORDER BY items DESC;


BEGIN;

CREATE TABLE IF NOT EXISTS odg_product_point_log (
  id           bigserial PRIMARY KEY,
  ic_code      varchar(50) NOT NULL,
  before_value smallint,                 -- NULL = ບໍ່ຮູ້ຄ່າກ່ອນໜ້າ
  after_value  smallint    NOT NULL,
  reason       varchar(255) NOT NULL DEFAULT '',
  changed_by   varchar(50)  NOT NULL,
  changed_at   timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS odg_product_point_log_code_idx
  ON odg_product_point_log (ic_code, changed_at DESC);

CREATE INDEX IF NOT EXISTS odg_product_point_log_recent_idx
  ON odg_product_point_log (changed_at DESC);

-- ບັນທຶກສະຖານະ ณ ວັນທີຣັນ ເປັນຈຸດເລີ່ມຕົ້ນ ເພື່ອໃຫ້ການປຽບທຽບຕໍ່ໄປມີຖານອ້າງອີງ
INSERT INTO odg_product_point_log (ic_code, before_value, after_value, reason, changed_by)
SELECT d.ic_code, NULL, COALESCE(d.have_point, 0),
       'ບັນທຶກສະຖານະເລີ່ມຕົ້ນ ຕອນຕິດຕັ້ງ migration 004', 'migration-004'
  FROM ic_inventory_detail d
 WHERE NOT EXISTS (SELECT 1 FROM odg_product_point_log l WHERE l.ic_code = d.ic_code);

-- ກວດ: ຄວນເທົ່າຈຳນວນສິນຄ້າທັງໝົດ (~24,493)
SELECT count(*) AS logged, count(*) FILTER (WHERE after_value = 1) AS have_point
  FROM odg_product_point_log;

COMMIT;   -- ຫຼື ROLLBACK;


-- ============================================================================
-- ຄືນຄ່າ
--   BEGIN;
--     DROP TABLE IF EXISTS odg_product_point_log;
--   COMMIT;
-- ============================================================================
