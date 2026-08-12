-- ============================================================================
-- 005_member_tier.sql
--
-- ລະບົບລະດັບສະມາຊິກ (Silver / Gold / Platinum)
--
-- !! ຍັງບໍ່ໄດ້ຣັນ — ສ້າງໄວ້ໃຫ້ກວດກ່ອນ !!
--
-- ບັນຫາທີ່ແກ້:
--   odg_pomotion_point.card_type ກັ່ນລາງວັນດ້ວຍລະດັບ (Silver 100-500 ແຕ້ມ,
--   Gold 1,000-1,500, Platinum 2,000-3,000) ແຕ່ຄົ້ນທັງຖານຂໍ້ມູນແລ້ວ
--   ບໍ່ມີຕາຕະລາງໃດກຳນົດລະດັບໃຫ້ລູກຄ້າເລີຍ — card_type ມີຢູ່ຕາຕະລາງລາງວັນເອງ
--   ພຽງບ່ອນດຽວ. ມີ 4 ຄົນຈາກ 20,954 ທີ່ພິມຄຳວ່າ gold ໄວ້ໃນ cust_group_2
--
--   ຜົນຄື ລາງວັນ Gold 25 ລາຍການ ແລະ Platinum 24 ລາຍການ ບໍ່ມີໃຜເຂົ້າເຖິງໄດ້
--
-- ວິທີແກ້: ໃຫ້ລະດັບຄິດຈາກແຕ້ມສະສົມຕາມກົດທີ່ຕັ້ງໄດ້ + ອະນຸຍາດຕັ້ງມືເປັນລາຍຄົນ
--          ຮອງຮັບທັງສອງແບບ ຈຶ່ງບໍ່ຕ້ອງເລືອກຢ່າງໃດຢ່າງໜຶ່ງແຕ່ຕົ້ນ
-- ============================================================================

-- ກວດກ່ອນ: ການກະຈາຍແຕ້ມປີ 2026 (ໃຊ້ຕັ້ງເກນ)
WITH b AS (
  SELECT cust_code, sum(get_new_point * CASE WHEN calc_flag = -1 THEN -1 ELSE 1 END)::int AS pts
    FROM odg_member_point WHERE extract(year FROM doc_date) = 2026 GROUP BY 1)
SELECT count(*) AS custs,
       count(*) FILTER (WHERE pts >= 100)  AS ge_100,
       count(*) FILTER (WHERE pts >= 300)  AS ge_300,
       count(*) FILTER (WHERE pts >= 500)  AS ge_500,
       count(*) FILTER (WHERE pts >= 1000) AS ge_1000,
       count(*) FILTER (WHERE pts >= 2000) AS ge_2000,
       max(pts) AS max_pts
  FROM b;
-- ຄາດໝາຍ: 5,185 ຄົນ · ≥100 = 2,107 · ≥300 = 585 · ≥500 = 240
--          ≥1000 = 46 · ≥2000 = 8 · ສູງສຸດ 5,486


BEGIN;

-- ກົດແປງແຕ້ມເປັນລະດັບ. ລະດັບທີ່ min_points ສູງສຸດທີ່ຍັງ <= ແຕ້ມ ຄືລະດັບທີ່ໄດ້
CREATE TABLE IF NOT EXISTS odg_member_tier_rule (
  id          bigserial PRIMARY KEY,
  tier_code   varchar(10)  NOT NULL,      -- odg_member_level.code (0/1/2)
  min_points  integer      NOT NULL,
  from_year   integer      NOT NULL,      -- ໃຊ້ແຕ່ປີນີ້ເປັນຕົ້ນໄປ
  is_active   smallint     NOT NULL DEFAULT 1,
  note        varchar(255) NOT NULL DEFAULT '',
  created_by  varchar(50)  NOT NULL,
  created_at  timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by  varchar(50),
  updated_at  timestamp without time zone,
  CONSTRAINT odg_member_tier_rule_min_nonneg CHECK (min_points >= 0),
  CONSTRAINT odg_member_tier_rule_unique UNIQUE (tier_code, from_year)
);

CREATE INDEX IF NOT EXISTS odg_member_tier_rule_lookup_idx
  ON odg_member_tier_rule (from_year, min_points DESC) WHERE is_active = 1;

-- ຕັ້ງມືເປັນລາຍຄົນ — ຊະນະກົດສະເໝີ (ເຊັ່ນ ໃຫ້ VIP ຫຼື ແກ້ກໍລະນີພິເສດ)
CREATE TABLE IF NOT EXISTS odg_member_tier_override (
  id         bigserial PRIMARY KEY,
  cust_code  varchar(50)  NOT NULL,
  year       integer      NOT NULL,
  tier_code  varchar(10)  NOT NULL,
  reason     varchar(255) NOT NULL DEFAULT '',
  changed_by varchar(50)  NOT NULL,
  changed_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT odg_member_tier_override_unique UNIQUE (cust_code, year)
);

CREATE INDEX IF NOT EXISTS odg_member_tier_override_year_idx
  ON odg_member_tier_override (year, cust_code);

-- ເກນເລີ່ມຕົ້ນ ອີງລາຄາລາງວັນທີ່ມີຢູ່ຈິງ ເພື່ອໃຫ້ຜູ້ໄດ້ລະດັບແລກລາງວັນລະດັບນັ້ນໄດ້ແທ້:
--   Silver   ທຸກຄົນ        (ລາງວັນ 100-500 ແຕ້ມ)
--   Gold     ≥ 1,000 ແຕ້ມ  (ລາງວັນ 1,000-1,500) → 46 ຄົນ ປີ 2026
--   Platinum ≥ 2,000 ແຕ້ມ  (ລາງວັນ 2,000-3,000) → 8 ຄົນ ປີ 2026
--
-- ຖ້າຢາກໃຫ້ຄົນຮອດລະດັບຫຼາຍກວ່ານີ້ ໃຫ້ຫຼຸດເກນລົງໃນໜ້າ PMS ໄດ້ເລີຍ
-- ແຕ່ຕ້ອງຫຼຸດລາຄາລາງວັນນຳ ບໍ່ດັ່ງນັ້ນຈະໄດ້ລະດັບແຕ່ແລກບໍ່ໄດ້
INSERT INTO odg_member_tier_rule (tier_code, min_points, from_year, note, created_by)
SELECT v.tier_code, v.min_points, 2026, v.note, 'migration-005'
  FROM (VALUES ('0', 0,    'Silver — ທຸກຄົນທີ່ເປັນສະມາຊິກ'),
               ('1', 1000, 'Gold — ອີງລາຄາລາງວັນ Gold 1,000-1,500'),
               ('2', 2000, 'Platinum — ອີງລາຄາລາງວັນ Platinum 2,000-3,000')
       ) AS v(tier_code, min_points, note)
 WHERE NOT EXISTS (SELECT 1 FROM odg_member_tier_rule r
                    WHERE r.tier_code = v.tier_code AND r.from_year = 2026);

-- ກວດ: ຄວນໄດ້ 3 ແຖວ
SELECT r.tier_code, l.name_1 AS tier, r.min_points, r.from_year, r.is_active, r.note
  FROM odg_member_tier_rule r
  LEFT JOIN odg_member_level l ON l.code = r.tier_code
 ORDER BY r.min_points;

COMMIT;   -- ຫຼື ROLLBACK;


-- ກວດຜົນຫຼັງຕັ້ງເກນ: ແຕ່ລະລະດັບຈະມີຈັກຄົນ
WITH b AS (
  SELECT cust_code, sum(get_new_point * CASE WHEN calc_flag = -1 THEN -1 ELSE 1 END)::int AS pts
    FROM odg_member_point WHERE extract(year FROM doc_date) = 2026 GROUP BY 1)
SELECT COALESCE(l.name_1, '(ບໍ່ຮອດເກນ)') AS tier, count(*) AS members
  FROM b
  LEFT JOIN LATERAL (
    SELECT r.tier_code FROM odg_member_tier_rule r
     WHERE r.is_active = 1 AND r.from_year <= 2026 AND r.min_points <= b.pts
     ORDER BY r.min_points DESC LIMIT 1) t ON true
  LEFT JOIN odg_member_level l ON l.code = t.tier_code
 GROUP BY 1 ORDER BY members DESC;


-- ============================================================================
-- ຄືນຄ່າ
--   BEGIN;
--     DROP TABLE IF EXISTS odg_member_tier_override;
--     DROP TABLE IF EXISTS odg_member_tier_rule;
--   COMMIT;
-- ============================================================================
