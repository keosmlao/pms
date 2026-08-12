-- ============================================================================
-- 003_loyalty_config_standard.sql
--
-- ວາງມາດຕະຖານການຕັ້ງຄ່າແຕ້ມສະສົມ ໃຫ້ຕັ້ງແຍກຕາມຊ່ອງທາງ ແລະ BU ໄດ້
--
-- !! ຍັງບໍ່ໄດ້ຣັນ — ສ້າງໄວ້ໃຫ້ກວດກ່ອນ !!
--
-- ໜ້າ /loyalty ແທັບ "ຕັ້ງຄ່າ" ຈະກວດເອງວ່າ migration ນີ້ຣັນແລ້ວຫຼືຍັງ
-- ຖ້າຍັງ ຈະຂຶ້ນປ້າຍບອກແທນທີ່ຈະ error
--
-- ເປັນຫຍັງຈຶ່ງສ້າງຕາຕະລາງໃໝ່ ແທນທີ່ຈະໄປແກ້ pos_point_period:
--   pos_point_period ເປັນຂອງລະບົບ POS (ຫວ່າງເປົ່າ 0 ແຖວ ແຕ່ໂຄ້ດ POS ອາດອ່ານຢູ່)
--   ການເພີ່ມຖັນໃສ່ຕາຕະລາງຂອງລະບົບອື່ນ ສ່ຽງກະທົບການ sync
--   ຈຶ່ງໃຊ້ຕາຕະລາງທີ່ PMS ເປັນເຈົ້າຂອງເອງ ຄືກັບ 001_product_spare_mapping
-- ============================================================================


-- ############################################################################
-- 1. ເພີ່ມລະຫັດຊ່ອງທາງທີ່ຍັງຂາດ
--
--    ປັດຈຸບັນ pmt_channel_group ມີພຽງ 3 ລະຫັດ (101 ໜ້າຮ້ານ, 102 ຂາຍສົ່ງ,
--    10202 ຊ່າງ) ແຕ່ odg_sale_detail.channel_name ມີ 6 ຄ່າ ຈຶ່ງກຳນົດຂອບເຂດ
--    ໃຫ້ຜູ້ຮັບຜິດຊອບ ຂາຍໂຄງການ / ບໍລິການ / ອອນລາຍ ບໍ່ໄດ້ເລີຍ
--
--    ລະຫັດທີ່ເລືອກ (103/104/109) ວ່າງຢູ່ — ກວດແລ້ວບໍ່ຊ້ຳກັບຂອງເດີມ
-- ############################################################################

-- ກວດກ່ອນ: ຄວນໄດ້ 3 ແຖວ (101, 102, 10202)
SELECT code, name_1 FROM pmt_channel_group ORDER BY code;

BEGIN;

INSERT INTO pmt_channel_group (code, name_1)
SELECT v.code, v.name_1
  FROM (VALUES ('103', 'ຂາຍໂຄງການ'),
               ('104', 'ບໍລິການ'),
               ('109', 'ຂາຍອອນລາຍ')) AS v(code, name_1)
 WHERE NOT EXISTS (SELECT 1 FROM pmt_channel_group p WHERE p.code = v.code);

-- ກວດ: ຄວນໄດ້ 6 ແຖວ
SELECT code, name_1 FROM pmt_channel_group ORDER BY code;

COMMIT;   -- ຫຼື ROLLBACK;


-- ############################################################################
-- 2. ຕາຕະລາງອັດຕາການສະສົມແຕ້ມ ແຍກຕາມຊ່ອງທາງ × BU
--
--    ປັດຈຸບັນອັດຕາ 50,000 ກີບ/ແຕ້ມ ຝັງຢູ່ໃນໂຄ້ດ POS/AR (pos_point_period
--    ຫວ່າງເປົ່າ) ຈຶ່ງປ່ຽນຕໍ່ຊ່ອງທາງບໍ່ໄດ້ ແລະ ກວດຍ້ອນຫຼັງບໍ່ໄດ້ວ່າເຄີຍໃຊ້ອັດຕາໃດ
-- ############################################################################
BEGIN;

CREATE TABLE IF NOT EXISTS odg_loyalty_earn_rule (
  id             bigserial PRIMARY KEY,
  -- pmt_channel_group.code · '' = ທຸກຊ່ອງທາງ
  channel_group  varchar(20)   NOT NULL DEFAULT '',
  -- mas_bu.bu_code · '' = ທຸກ BU
  bu_code        varchar(20)   NOT NULL DEFAULT '',
  -- ກີບຕໍ່ 1 ແຕ້ມ (ປັດລົງ) — ຄ່າປັດຈຸບັນຂອງລະບົບຄື 50000
  kip_per_point  numeric(18,2) NOT NULL,
  -- ຕົວຄູນເພີ່ມ (ເຊັ່ນ x2 ວັນອາທິດ) · 1 = ບໍ່ຄູນ
  multiplier     numeric(6,2)  NOT NULL DEFAULT 1,
  from_date      date          NOT NULL,
  to_date        date,                                  -- NULL = ບໍ່ມີວັນສິ້ນສຸດ
  is_active      smallint      NOT NULL DEFAULT 1,
  note           varchar(255)  NOT NULL DEFAULT '',
  created_by     varchar(50)   NOT NULL,
  created_at     timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by     varchar(50),
  updated_at     timestamp without time zone,
  CONSTRAINT odg_loyalty_earn_rule_kip_positive  CHECK (kip_per_point > 0),
  CONSTRAINT odg_loyalty_earn_rule_mult_positive CHECK (multiplier > 0),
  CONSTRAINT odg_loyalty_earn_rule_dates         CHECK (to_date IS NULL OR to_date >= from_date),
  -- ກັນບໍ່ໃຫ້ໃສ່ກົດຊ້ຳ (ຊ່ອງທາງ + BU + ວັນເລີ່ມ) ດຽວກັນສອງເທື່ອ
  CONSTRAINT odg_loyalty_earn_rule_unique UNIQUE (channel_group, bu_code, from_date)
);

CREATE INDEX IF NOT EXISTS odg_loyalty_earn_rule_lookup_idx
  ON odg_loyalty_earn_rule (channel_group, bu_code, from_date DESC)
  WHERE is_active = 1;

-- ໃສ່ອັດຕາປັດຈຸບັນເປັນ baseline ເພື່ອໃຫ້ມີຈຸດອ້າງອີງ
-- from_date = ວັນທຳອິດທີ່ມີຂໍ້ມູນໃນ ledger
INSERT INTO odg_loyalty_earn_rule
       (channel_group, bu_code, kip_per_point, multiplier, from_date, note, created_by)
SELECT '', '', 50000, 1, DATE '2024-01-01',
       'ອັດຕາພື້ນຖານທີ່ລະບົບ POS/AR ໃຊ້ຢູ່ຈິງ (ຍ້າຍມາຈາກໂຄ້ດ)', 'migration-003'
 WHERE NOT EXISTS (SELECT 1 FROM odg_loyalty_earn_rule);

-- ກວດ: ຄວນໄດ້ 1 ແຖວ, kip_per_point = 50000
SELECT id, channel_group, bu_code, kip_per_point, multiplier,
       from_date::text, to_date::text, is_active, note
  FROM odg_loyalty_earn_rule ORDER BY id;

COMMIT;   -- ຫຼື ROLLBACK;


-- ############################################################################
-- 3. ບັນທຶກການແກ້ໄຂຕັ້ງຄ່າ (audit)
--
--    ໜ້າ PMS ຈະຂຽນລົງນີ້ທຸກຄັ້ງທີ່ມີການແກ້ກົດ ຫຼື ແກ້ຫົວໂປຣ ເພື່ອໃຫ້ຮູ້ວ່າ
--    ໃຜແກ້ຫຍັງເມື່ອໃດ — ສຳຄັນເພາະ odg_pomotion_colection_point ເປັນຕາຕະລາງ
--    ທີ່ລະບົບອື່ນກໍຂຽນນຳ
-- ############################################################################
BEGIN;

CREATE TABLE IF NOT EXISTS odg_loyalty_config_log (
  id          bigserial PRIMARY KEY,
  entity      varchar(50)  NOT NULL,   -- 'earn_rule' | 'campaign' | 'extra_point'
  entity_id   varchar(50)  NOT NULL,
  action      varchar(20)  NOT NULL,   -- 'create' | 'update' | 'delete'
  before_json jsonb,
  after_json  jsonb,
  changed_by  varchar(50)  NOT NULL,
  changed_at  timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS odg_loyalty_config_log_recent_idx
  ON odg_loyalty_config_log (changed_at DESC);

COMMIT;   -- ຫຼື ROLLBACK;


-- ############################################################################
-- 4. ຄຳສັບຊ່ອງທາງທີ່ຍັງບໍ່ກົງກັນ — ຍັງບໍ່ແກ້ ຕ້ອງຕົກລົງກ່ອນ
--
--    ປັດຈຸບັນມີ 5 ຊຸດ:
--      pmt_channel_group             101 / 102 / 10202          ← ສະເໜີໃຫ້ເປັນຫຼັກ
--      odg_channel_group             RT / WS / IN / PJ / ALL
--      odg_member_extra_point.cust_group   10101
--      odg_sale_detail.channel_name  ຂາຍໜ້າຮ້ານ / ຂາຍສົ່ງ / ...
--      member_lineoa_info.channel_group    ໜ້າຮ້ານ / ຮ້ານຂາຍສົ່ງ / ຊ່າງ
--
--    ພິສູດແລ້ວວ່າ pmt_channel_group ກົງກັບຍອດຂາຍຈິງ 99.6%:
--      101 → ຂາຍໜ້າຮ້ານ  807/807
--      102 → ຂາຍສົ່ງ     5,584/5,595
--      10202 → ຂາຍຊ່າງ   362/375
--
--    ຂັ້ນຕໍ່ໄປທີ່ແນະນຳ (ຍັງບໍ່ໃສ່ຄຳສັ່ງໄວ້ ເພາະກະທົບລະບົບອື່ນ):
--      ກ. ປ່ຽນ odg_member_extra_point.cust_group '10101' → '101'
--         UPDATE odg_member_extra_point      SET cust_group='101' WHERE cust_group='10101';
--         UPDATE odg_member_extra_point_free SET cust_group='101' WHERE cust_group='10101';
--         ຕ້ອງກວດກ່ອນວ່າໂຄ້ດ POS ອ່ານຄ່ານີ້ແບບໃດ ບໍ່ດັ່ງນັ້ນໂປຣຄູນແຕ້ມຈະບໍ່ເຂົ້າ
--
--      ຂ. ເພີ່ມ ref_code ໃສ່ pmt_channel_group ໃຫ້ map ຫາ channel_name ໄດ້ໂດຍກົງ
--         ດຽວນີ້ PMS map ໄວ້ໃນໂຄ້ດ (src/lib/loyalty.ts CHANNEL_CODE_TO_SALE_NAME)
--         ຖ້າຍ້າຍມາໄວ້ໃນ DB ຈະແກ້ບ່ອນດຽວ
--
--      ຄ. ບັງຄັບຊ່ອງທາງຕອນຄິດແຕ້ມໂປຣ — ດຽວນີ້ມີ 24 ໃບ / 235 ຄະແນນ
--         ທີ່ໄດ້ແຕ້ມນອກຊ່ອງທາງທີ່ໂປຣປະກາດໄວ້
-- ############################################################################


-- ############################################################################
-- ຄືນຄ່າ
-- ############################################################################
--   BEGIN;
--     DROP TABLE IF EXISTS odg_loyalty_config_log;
--     DROP TABLE IF EXISTS odg_loyalty_earn_rule;
--     DELETE FROM pmt_channel_group WHERE code IN ('103','104','109');
--   COMMIT;
-- ============================================================================
