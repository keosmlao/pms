-- ============================================================================
-- 002_loyalty_data_fixes.sql
--
-- ແກ້ໄຂຂໍ້ມູນແຕ້ມສະສົມ LINE OA (odg_member_point / member_lineoa_info)
--
-- !! ຍັງບໍ່ໄດ້ຣັນ — ສ້າງໄວ້ໃຫ້ກວດກ່ອນ !!
--
-- ວິທີໃຊ້:
--   1. ຣັນ ພາກ A (ກວດກ່ອນ) ຢ່າງດຽວ — ເປັນ SELECT ລ້ວນ, ບໍ່ແກ້ຂໍ້ມູນ
--   2. ກວດຜົນວ່າກົງກັບຄາດໝາຍ (ຈຳນວນແຖວທີ່ຄາດໄວ້ຢູ່ໃນ comment ແຕ່ລະຂໍ້,
--      ອີງຂໍ້ມູນວັນທີ 2026-08-07)
--   3. ຕັດສິນໃຈແຕ່ລະຂໍ້ວ່າຈະແກ້ ຫຼື ບໍ່ — ຂໍ້ 3 ແລະ 4 ເປັນນະໂຍບາຍ ບໍ່ແມ່ນ bug
--   4. ຣັນ ພາກ B ໃນ BEGIN; ... ກວດ ... COMMIT; (ຫຼື ROLLBACK;)
--
-- ຂໍ້ມູນອ້າງອີງ:
--   ອັດຕາ: 50,000 ກີບ = 1 ແຕ້ມ (ປັດລົງ)
--   calc_flag = 1 ໃຫ້ແຕ້ມ, -1 ຫັກແຕ້ມ
--   doc prefix: CAK ຂາຍ · CNK ຄືນສິນຄ້າ · RWRT ແລກລາງວັນ · ETF/ET ແຕ້ມແຖມ
--   odg_member_point ບໍ່ມີ ref_doc ໃນແຖວ CNK ຈຶ່ງຕ້ອງຈັບຄູ່ດ້ວຍ
--   (cust_code + total_amount) — ບໍ່ແມ່ນການເຊື່ອມໂຍງທີ່ແນ່ນອນ 100%
-- ============================================================================


-- ############################################################################
-- ພາກ A — ກວດກ່ອນ (SELECT ລ້ວນ, ປອດໄພ)
-- ############################################################################

-- A0. ສຳຮອງຕາຕະລາງກ່ອນແກ້ (ຣັນກ່ອນພາກ B ສະເໝີ)
--     ຖ້າຕ້ອງການຄືນຄ່າ: ເບິ່ງ ພາກ C
CREATE TABLE IF NOT EXISTS odg_member_point_bk_20260807 AS
  SELECT * FROM odg_member_point;


-- A1. ໃບຄືນສິນຄ້າ (CNK) ທີ່ຫັກແຕ້ມ ທັ້ງທີ່ບິນຂາຍຍອດດຽວກັນໄດ້ 0 ແຕ້ມ
--     ຄາດໝາຍ: 15 ແຖວ, ລວມ 3,015 ແຕ້ມ
SELECT cn.roworder, cn.doc_no, cn.doc_date, cn.cust_code,
       cn.total_amount, cn.get_new_point AS points_taken,
       (SELECT string_agg(s.doc_no, ', ' ORDER BY s.doc_date)
          FROM odg_member_point s
         WHERE s.cust_code = cn.cust_code AND s.calc_flag = 1
           AND s.total_amount = cn.total_amount AND s.point_amount = 0) AS zero_point_sales
  FROM odg_member_point cn
 WHERE cn.doc_no LIKE 'CNK%' AND cn.calc_flag = -1 AND cn.get_new_point > 0
   AND EXISTS (SELECT 1 FROM odg_member_point s
                WHERE s.cust_code = cn.cust_code AND s.calc_flag = 1
                  AND s.total_amount = cn.total_amount AND s.point_amount = 0)
 ORDER BY cn.doc_date DESC;


-- A2. ລູກຄ້າທີ່ຍອດປິດປີຕິດລົບ
--     ຄາດໝາຍ: 5 ແຖວ (2025: 4 ຄົນ, 2026: 1 ຄົນ)
--
--     ໝາຍເຫດສຳຄັນ: ຢ່າໃຊ້ running balance (sum() OVER ORDER BY doc_date)
--     ເພື່ອຫາລາຍການນີ້ — ບິນ CAK ຖືກ backfill ໃສ່ ledger ຫຼັງ RWRT ຫຼາຍວັນ
--     ເຮັດໃຫ້ເຫັນ "ຕິດລົບ" 81 ຄົນ ທັ້ງທີ່ຄວາມຈິງບໍ່ໄດ້ຕິດລົບ. ຍອດລວມທັງປີ
--     ບໍ່ຂຶ້ນກັບລຳດັບ ຈຶ່ງເຊື່ອຖືໄດ້
SELECT extract(year FROM doc_date)::int AS yr, cust_code,
       sum(get_new_point) FILTER (WHERE calc_flag = 1)  AS earned,
       sum(get_new_point) FILTER (WHERE calc_flag = -1) AS burned,
       sum(get_new_point * CASE WHEN calc_flag = -1 THEN -1 ELSE 1 END) AS balance
  FROM odg_member_point
 GROUP BY 1, 2
HAVING sum(get_new_point * CASE WHEN calc_flag = -1 THEN -1 ELSE 1 END) < 0
 ORDER BY balance;


-- A3. LINE ID ດຽວ ຜູກຫຼາຍລະຫັດລູກຄ້າ
--     ຄາດໝາຍ: 9 LINE ID (ແຕ່ລະອັນ 2 ລະຫັດ)
SELECT m.line_id,
       string_agg(m.code, ', ' ORDER BY m.code)   AS cust_codes,
       string_agg(COALESCE(m.name_1,''), ' / ' ORDER BY m.code) AS names,
       string_agg(COALESCE(m.telephone,''), ' / ' ORDER BY m.code) AS phones,
       COALESCE(sum(p.pts), 0) AS total_points
  FROM member_lineoa_info m
  LEFT JOIN (SELECT cust_code,
                    sum(get_new_point * CASE WHEN calc_flag = -1 THEN -1 ELSE 1 END) AS pts
               FROM odg_member_point GROUP BY 1) p ON p.cust_code = m.code
 WHERE m.line_id IS NOT NULL AND m.line_id <> ''
 GROUP BY m.line_id
HAVING count(*) > 1
 ORDER BY total_points DESC;


-- A4. ບິນທີ່ຄິດແຕ້ມໜ້ອຍກວ່າສູດລະດັບບິນ
--     ຄາດໝາຍ: 1,564 ບິນ (8.3% ຂອງ 18,902 ບິນທີ່ໄດ້ແຕ້ມ), ຂາດລວມ 1,797 ແຕ້ມ
SELECT count(*) AS affected_docs,
       sum(floor(point_amount / 50000) - get_new_point) AS points_short,
       min(floor(point_amount / 50000) - get_new_point) AS min_gap,
       max(floor(point_amount / 50000) - get_new_point) AS max_gap
  FROM odg_member_point
 WHERE calc_flag = 1 AND point_amount > 0
   AND get_new_point < floor(point_amount / 50000);


-- ============================================================================
-- ໂປຣໂມຊັ່ນສະສົມແຕ້ມ (ຄົນລະລະບົບກັບແຕ້ມສະມາຊິກຂ້າງເທິງ)
--
--   odg_pomotion_colection_point              ຫົວໂປຣ (120)
--   odg_pomotion_colection_point_detail       ສິນຄ້າທີ່ໄດ້ຄະແນນ (1,618)
--   odg_pomotion_colection_point_detail_used  ລາຍການແລກ (2,425)
--   odg_pomotion_colection_transection        ledger ຄະແນນ (17,086)
--   odg_pomotion_colection_total              ຍອດຄົງເຫຼືອຕໍ່ (ລູກຄ້າ × ໂປຣ) (3,420)
--
--   doc prefix: RWSO = ໃບແລກຂອງລາງວັນ · ອື່ນໆ = ໃບຂາຍທີ່ໄດ້ຄະແນນ
-- ============================================================================

-- A5. ຍອດຄະແນນໂປຣທີ່ບໍ່ກົງ ledger ຫຼື ຕິດລົບ
--     ຄາດໝາຍ: 61 ບໍ່ກົງ (ເກີນ 317 ຄະແນນ) · 22 ບໍ່ມີ ledger · 15 ຕິດລົບ (-323.5)
WITH tx AS (
  SELECT cust_code, pro_code,
         sum(get_point * CASE WHEN calc_flag = -1 THEN -1 ELSE 1 END) AS pts
    FROM odg_pomotion_colection_transection GROUP BY 1, 2)
SELECT CASE WHEN t.total_point < 0 THEN 'ຍອດຕິດລົບ'
            WHEN x.pts IS NULL     THEN 'ບໍ່ມີລາຍການໃນ ledger'
            ELSE 'ຍອດບໍ່ກົງ ledger' END AS kind,
       count(*) AS n,
       sum(t.total_point) AS stored_points,
       sum(t.total_point - COALESCE(x.pts, 0)) AS diff
  FROM odg_pomotion_colection_total t
  LEFT JOIN tx x ON x.cust_code = t.cust_code AND x.pro_code = t.pro_code
 WHERE t.total_point < 0 OR x.pts IS NULL OR t.total_point <> x.pts
 GROUP BY 1;


-- A6. ໂປຣທີ່ຄະແນນລວມຕິດລົບ (ແລກອອກຫຼາຍກວ່າທີ່ອອກໃຫ້)
SELECT t.pro_code, p.pro_name,
       sum(t.get_point) FILTER (WHERE t.calc_flag = 1)  AS earned,
       sum(t.get_point) FILTER (WHERE t.calc_flag = -1) AS redeemed,
       sum(t.get_point * CASE WHEN t.calc_flag = -1 THEN -1 ELSE 1 END) AS balance
  FROM odg_pomotion_colection_transection t
  LEFT JOIN odg_pomotion_colection_point p ON p.pro_code = t.pro_code
 GROUP BY 1, 2
HAVING sum(t.get_point * CASE WHEN t.calc_flag = -1 THEN -1 ELSE 1 END) < 0
 ORDER BY balance;


-- ############################################################################
-- ພາກ B — ແກ້ໄຂ
--
-- ຣັນທີລະຂໍ້ ພາຍໃນ transaction:
--     BEGIN;
--       <ຄຳສັ່ງຂອງຂໍ້ນັ້ນ>
--       <SELECT ກວດຜົນ>
--     COMMIT;   -- ຫຼື ROLLBACK; ຖ້າຜົນບໍ່ຖືກ
-- ############################################################################

-- ---------------------------------------------------------------------------
-- B1. ຄືນແຕ້ມທີ່ຖືກໃບ CNK ຫັກຜິດ  (ແກ້ບັນຫາຂໍ້ A1)
--
--     ວິທີ: ບໍ່ລຶບແຖວ CNK ເດີມ (ຮັກສາຮ່ອງຮອຍບັນຊີ) ແຕ່ຕັ້ງແຕ້ມທີ່ຫັກເປັນ 0
--     ຜົນທີ່ຄາດ: UPDATE 15
-- ---------------------------------------------------------------------------
BEGIN;

UPDATE odg_member_point cn
   SET get_new_point = 0,
       point_amount  = 0
 WHERE cn.doc_no LIKE 'CNK%'
   AND cn.calc_flag = -1
   AND cn.get_new_point > 0
   AND EXISTS (SELECT 1 FROM odg_member_point s
                WHERE s.cust_code = cn.cust_code
                  AND s.calc_flag = 1
                  AND s.total_amount = cn.total_amount
                  AND s.point_amount = 0);

-- ກວດ: ຄວນໄດ້ 0 ແຖວ
SELECT count(*) AS remaining_wrong_deductions
  FROM odg_member_point cn
 WHERE cn.doc_no LIKE 'CNK%' AND cn.calc_flag = -1 AND cn.get_new_point > 0
   AND EXISTS (SELECT 1 FROM odg_member_point s
                WHERE s.cust_code = cn.cust_code AND s.calc_flag = 1
                  AND s.total_amount = cn.total_amount AND s.point_amount = 0);

COMMIT;   -- ຫຼື ROLLBACK;


-- ---------------------------------------------------------------------------
-- B2. ປັບຍອດປິດປີທີ່ຍັງຕິດລົບໃຫ້ເປັນ 0  (ແກ້ບັນຫາຂໍ້ A2)
--
--     ຣັນ ຫຼັງ B1 ເທົ່ານັ້ນ — B1 ຈະແກ້ຄົນທີ່ຕິດລົບຍ້ອນ CNK ໄປແລ້ວ
--     (2078148013 = -609 ແລະ 2055516408 = -148 ຈະຫາຍໄປເອງ)
--     ທີ່ເຫຼືອແມ່ນຄົນທີ່ແລກລາງວັນເກີນຍອດຈິງ — ຕ້ອງໃສ່ແຖວປັບປຸງໃຫ້ກັບເປັນ 0
--     ຜົນທີ່ຄາດ: INSERT 3 (2059568668, 2054445490, 2055712888)
--
--     ຖ້ານະໂຍບາຍຄືໃຫ້ລູກຄ້າຮັບຜິດຊອບໜີ້ແຕ້ມນັ້ນ ໃຫ້ຂ້າມຂໍ້ນີ້
-- ---------------------------------------------------------------------------
BEGIN;

INSERT INTO odg_member_point
       (doc_no, doc_date, cust_code, total_amount, point_amount,
        ar_point_balance, get_new_point, sum_point, create_date_time_now,
        status, calc_flag, is_manual)
SELECT 'ADJ' || to_char(CURRENT_DATE,'YYMMDD') || '-' || b.cust_code || '-' || b.yr,
       make_date(b.yr, 12, 31),
       b.cust_code,
       0, 0, 0,
       -b.balance,          -- balance ຕິດລົບ → ຄືນເປັນບວກເທົ່າກັນ
       0,
       CURRENT_TIMESTAMP,
       0, 1, 1              -- is_manual = 1 ໝາຍວ່າປັບປຸງດ້ວຍມື
  FROM (SELECT extract(year FROM doc_date)::int AS yr, cust_code,
               sum(get_new_point * CASE WHEN calc_flag = -1 THEN -1 ELSE 1 END) AS balance
          FROM odg_member_point
         GROUP BY 1, 2
        HAVING sum(get_new_point * CASE WHEN calc_flag = -1 THEN -1 ELSE 1 END) < 0) b;

-- ກວດ: ຄວນໄດ້ 0 ແຖວ
SELECT extract(year FROM doc_date)::int AS yr, cust_code,
       sum(get_new_point * CASE WHEN calc_flag = -1 THEN -1 ELSE 1 END) AS balance
  FROM odg_member_point GROUP BY 1, 2
HAVING sum(get_new_point * CASE WHEN calc_flag = -1 THEN -1 ELSE 1 END) < 0;

COMMIT;   -- ຫຼື ROLLBACK;


-- ---------------------------------------------------------------------------
-- B3. ຍອດຄົງເຫຼືອປິດປີ (odg_ar_customer_point) ໃຫ້ກົງກັບ ledger ຫຼັງແກ້
--
--     ຣັນ ຫຼັງ B1 + B2 — ຖ້າຂ້າມ ຍອດທີ່ LINE OA ສະແດງຈະຍັງເປັນຄ່າເກົ່າ
--     ປີ 2026 ຍັງບໍ່ປິດ ຈຶ່ງບໍ່ມີແຖວ — ຂ້າມໄປ, ລະບົບຄິດສົດຢູ່ແລ້ວ
--     ຜົນທີ່ຄາດ: UPDATE ປະມານ 5-6 ແຖວ (ສະເພາະຄົນທີ່ຖືກແກ້)
-- ---------------------------------------------------------------------------
BEGIN;

UPDATE odg_ar_customer_point b
   SET point_balance = l.pts
  FROM (SELECT cust_code, extract(year FROM doc_date)::int AS yr,
               sum(get_new_point * CASE WHEN calc_flag = -1 THEN -1 ELSE 1 END) AS pts
          FROM odg_member_point GROUP BY 1, 2) l
 WHERE l.cust_code = b.ar_code
   AND l.yr::text = b.year
   AND b.point_balance <> l.pts;

-- ກວດ: ຄວນເຫຼືອແຕ່ 2 ຄົນທີ່ຕ່າງກັນມາແຕ່ເດີມ (2052334499 +380, 2052412009 +1250)
-- ຖ້າຢືນຢັນວ່າສອງຄົນນີ້ຄືການປັບດ້ວຍມືທີ່ຖືກຕ້ອງ ກໍປ່ອຍໄວ້
SELECT b.ar_code, b.year, b.point_balance, l.pts, (b.point_balance - l.pts) AS diff
  FROM odg_ar_customer_point b
  JOIN (SELECT cust_code, extract(year FROM doc_date)::int AS yr,
               sum(get_new_point * CASE WHEN calc_flag = -1 THEN -1 ELSE 1 END) AS pts
          FROM odg_member_point GROUP BY 1, 2) l
    ON l.cust_code = b.ar_code AND l.yr::text = b.year
 WHERE b.point_balance <> l.pts;

COMMIT;   -- ຫຼື ROLLBACK;


-- ---------------------------------------------------------------------------
-- B4. ບັນຊີຊ້ຳ — LINE ID ດຽວ ຜູກຫຼາຍລະຫັດລູກຄ້າ  (ບັນຫາຂໍ້ A3)
--
--     ບໍ່ມີຄຳສັ່ງອັດຕະໂນມັດໃຫ້ — ການລວມບັນຊີລູກຄ້າກະທົບ AR, ປະຫວັດການຂາຍ
--     ແລະ ໜີ້ ບໍ່ແມ່ນແຕ່ແຕ້ມ ຈຶ່ງຕ້ອງໃຫ້ຝ່າຍບັນຊີຕັດສິນທີລະລາຍ
--
--     ຂັ້ນຕອນທີ່ແນະນຳ ຕໍ່ 1 ຄູ່:
--       1. ເລືອກລະຫັດຫຼັກ (ປົກກະຕິແມ່ນອັນທີ່ຍັງເຄື່ອນໄຫວ / ມີແຕ້ມຫຼາຍກວ່າ)
--       2. ຍ້າຍແຕ້ມມາລະຫັດຫຼັກດ້ວຍແຖວປັບປຸງ (ຮູບແບບຄືກັບ B2):
--            - ໃສ່ແຖວລົບເທົ່າຍອດຢູ່ລະຫັດຮອງ
--            - ໃສ່ແຖວບວກເທົ່າກັນຢູ່ລະຫັດຫຼັກ
--       3. ລຶບ line_id ອອກຈາກລະຫັດຮອງ ເພື່ອບໍ່ໃຫ້ຜູກຊ້ຳອີກ:
--            UPDATE member_lineoa_info SET line_id = NULL WHERE code = '<ລະຫັດຮອງ>';
--
--     ຄູ່ທີ່ຄວນເຮັດກ່ອນ (ແຕ້ມຫຼາຍສຸດ):
--       U5522c3fba1f6a6e07a0edbe0841ca742 → 0205786367 (616 ແຕ້ມ) + 2057863679 (30)
--       Uae0ef5ca46ed43864c61892d7a830200 → 2058014540 (120) + 2077850159 (45)
--
--     ປ້ອງກັນບໍ່ໃຫ້ເກີດຊ້ຳ (ຣັນຫຼັງລວມບັນຊີໝົດແລ້ວເທົ່ານັ້ນ):
--       CREATE UNIQUE INDEX member_lineoa_info_line_id_uniq
--         ON member_lineoa_info (line_id) WHERE line_id IS NOT NULL AND line_id <> '';
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- B5. ອັດຕາຄິດແຕ້ມບໍ່ກົງກັນ — app_loyalty_config = 70,000 ແຕ່ production = 50,000
--
--     ຕ້ອງໃຫ້ຝ່າຍທຸລະກິດຢືນຢັນວ່າອັນໃດຖືກ ກ່ອນຈະແກ້
--     ຖ້າ 50,000 ຖືກ (ຄືທີ່ ledger ໃຊ້ຢູ່ຈິງ):
--
--       UPDATE app_loyalty_config SET earn_kip_per_point = 50000,
--              updated_at = CURRENT_TIMESTAMP, updated_by = '<ຜູ້ແກ້>'
--        WHERE is_active = true;
--
--     ຢ່າຕັ້ງ enabled = true ຈົນກວ່າຈະທົດສອບ — ຕາຕະລາງ ledger ຂອງລະບົບໃໝ່
--     (app_customer_points, app_customer_points_ledger, odg_ecom.loyalty_ledger)
--     ຍັງຫວ່າງເປົ່າ ໝາຍຄວາມວ່າຍັງບໍ່ເຄີຍໃຊ້ງານຈິງ
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- B6. ບິນທີ່ຄິດແຕ້ມຂາດ 1-3 ແຕ້ມ  (ບັນຫາຂໍ້ A4) — ຍັງບໍ່ແກ້
--
--     1,564 ບິນໄດ້ແຕ້ມໜ້ອຍກວ່າ floor(ຍອດລວມ / 50000) ລວມ 1,797 ແຕ້ມ. ຮູບແບບ
--     ກົງກັບການປັດລົງແຍກແຕ່ລະລາຍການສິນຄ້າແລ້ວຈຶ່ງບວກກັນ ເຊິ່ງອາດເປັນເຈດຕະນາ
--
--     ຕ້ອງຢືນຢັນນະໂຍບາຍກ່ອນ: ປັດຈາກຍອດລວມທັງບິນ ຫຼື ແຍກແຕ່ລະລາຍການ?
--       - ຖ້າ "ຍອດລວມທັງບິນ" ຖືກ → ຕ້ອງແກ້ໂຄ້ດຝັ່ງ POS/AR ທີ່ຄິດແຕ້ມ
--         (ບໍ່ໄດ້ຢູ່ໃນ repo ນີ້) ແລ້ວຈຶ່ງຄ່ອຍຄືນແຕ້ມຍ້ອນຫຼັງ
--       - ຖ້າ "ແຍກແຕ່ລະລາຍການ" ຖືກ → ບໍ່ຕ້ອງແກ້ຫຍັງ ພຽງແຕ່ບັນທຶກເປັນນະໂຍບາຍ
--
--     ແກ້ຂໍ້ມູນຢ່າງດຽວໂດຍບໍ່ແກ້ຕົ້ນທາງ ຈະເກີດຄືນອີກທຸກເດືອນ (ແນວໂນ້ມກຳລັງເພີ່ມ:
--     4.5% ປີ 2024 → 9.4% ປີ 2025 → 10.4% ປີ 2026)
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- B7. ຍອດຄະແນນໂປຣທີ່ບໍ່ກົງ ledger  (ແກ້ບັນຫາຂໍ້ A5)
--
--     odg_pomotion_colection_total ຄືຕົວເລກທີ່ລູກຄ້າເຫັນໃນ LINE OA ຈຶ່ງຄວນ
--     ໃຫ້ກົງກັບ ledger. ຜົນທີ່ຄາດ: UPDATE 61
--
--     ຢ່າຣັນຖ້າຍັງບໍ່ຢືນຢັນວ່າ ledger ຖືກ — ຖ້າ ledger ຕ່າງຫາກທີ່ຂາດລາຍການ
--     ການ sync ນີ້ຈະລຶບຄະແນນຂອງລູກຄ້າຖິ້ມ
-- ---------------------------------------------------------------------------
BEGIN;

CREATE TABLE IF NOT EXISTS odg_pomotion_colection_total_bk_20260807 AS
  SELECT * FROM odg_pomotion_colection_total;

UPDATE odg_pomotion_colection_total t
   SET total_point = x.pts
  FROM (SELECT cust_code, pro_code,
               sum(get_point * CASE WHEN calc_flag = -1 THEN -1 ELSE 1 END) AS pts
          FROM odg_pomotion_colection_transection GROUP BY 1, 2) x
 WHERE x.cust_code = t.cust_code AND x.pro_code = t.pro_code
   AND t.total_point <> x.pts;

-- ກວດ: ຄວນເຫຼືອແຕ່ແຖວ 'ບໍ່ມີລາຍການໃນ ledger' (22) ແລະ 'ຍອດຕິດລົບ' (15)
WITH tx AS (
  SELECT cust_code, pro_code,
         sum(get_point * CASE WHEN calc_flag = -1 THEN -1 ELSE 1 END) AS pts
    FROM odg_pomotion_colection_transection GROUP BY 1, 2)
SELECT count(*) FILTER (WHERE t.total_point <> x.pts) AS still_mismatched
  FROM odg_pomotion_colection_total t
  JOIN tx x ON x.cust_code = t.cust_code AND x.pro_code = t.pro_code;

COMMIT;   -- ຫຼື ROLLBACK;


-- ---------------------------------------------------------------------------
-- B8. ຄະແນນໂປຣຕິດລົບ (ບັນຫາຂໍ້ A5/A6) — ຍັງບໍ່ແກ້
--
--     15 ແຖວຕິດລົບ ລວມ -323.5 ຄະແນນ ແລະ ledger ກໍຕິດລົບຄືກັນ ໝາຍຄວາມວ່າ
--     ລະບົບອະນຸຍາດໃຫ້ແລກເກີນຍອດ — ອາການດຽວກັນກັບ RWRT ໃນຂໍ້ B2
--
--     ຕ້ອງແກ້ຕົ້ນທາງກ່ອນ (ກວດຍອດຄົງເຫຼືອຕອນອອກໃບ RWSO) ບໍ່ດັ່ງນັ້ນຈະເກີດຄືນ
--     ຈາກນັ້ນຈຶ່ງໃສ່ແຖວປັບປຸງໃຫ້ກັບເປັນ 0 ດ້ວຍຮູບແບບດຽວກັບ B2
-- ---------------------------------------------------------------------------


-- ############################################################################
-- ພາກ C — ຄືນຄ່າ (ຖ້າແກ້ແລ້ວມີບັນຫາ)
-- ############################################################################
--
-- ຄືນທັງຕາຕະລາງຈາກ backup ທີ່ສ້າງໄວ້ໃນ A0:
--
--   BEGIN;
--     DELETE FROM odg_member_point;
--     INSERT INTO odg_member_point SELECT * FROM odg_member_point_bk_20260807;
--   COMMIT;
--
-- ຄືນສະເພາະແຖວທີ່ B1 ແກ້:
--
--   BEGIN;
--     UPDATE odg_member_point p
--        SET get_new_point = b.get_new_point, point_amount = b.point_amount
--       FROM odg_member_point_bk_20260807 b
--      WHERE b.roworder = p.roworder AND p.doc_no LIKE 'CNK%';
--   COMMIT;
--
-- ຍົກເລີກແຖວປັບປຸງທີ່ B2 ໃສ່:
--
--   BEGIN;
--     DELETE FROM odg_member_point WHERE doc_no LIKE 'ADJ%' AND is_manual = 1;
--   COMMIT;
-- ============================================================================
