-- Seed the four ໃບຢັ້ງຢືນສົ່ງເສີມການຂາຍ sheets (trager incentive.xlsx, Q3 2026).
-- Numbers are entered EXACTLY as printed on the sheets — including the tier
-- targets/bonuses whose labelled % does not match the arithmetic — so the app
-- reports the document as approved.
--
-- Scope = the two electrical wholesale departments named on the sheets
-- ("ເຖິງ: ພະແນກຂາຍສົ່ງໄຟຟ້າ"): 2011 ຂາຍສົ່ງເຄື່ອງໃຊ້ໄຟຟ້າ (BU 11 ໄຟຟ້າ) ແລະ
-- 2061 ຂາຍສົ່ງໄຟຟ້າຂະໜາດນ້ອຍ (BU 15 ໄຟຟ້ານ້ອຍ). ຂາຍໜ້າຮ້ານ / ຂາຍຊ່າງ /
-- ຂາຍໂຄງການ ແລະ ຂາຍສົ່ງ BU ອື່ນ ບໍ່ນັບເຂົ້າ.

do $$
declare
  cid integer;
  lid integer;
begin
  if exists (select 1 from app_campaign) then
    raise notice 'app_campaign already seeded — skipping';
    return;
  end if;

  -- 1. ເຄື່ອງໃຊ້ພາຍໃນຄົວ ----------------------------------------------------
  insert into app_campaign (name, description, date_from, date_to, scope_kind, scope_codes, note, created_by)
  values ('ຂາຍເຄື່ອງໃຊ້ພາຍໃນຄົວ',
          'ກະທະໄຟຟ້າ, ໝໍ້ທອດໄຮນ້ຳມັນ, ໝໍ້ອົບຮົມຮ້ອນ, ໝໍ້ຕົ້ມອາເນກປະສົງ, ເຕົາຊີ້ນດາດ, ກາຕົ້ມນ້ຳ, ກະຕິກນ້ຳຮ້ອນ, ເຄື່ອງບົດສັບ, ເຕົາອົບ, ຫົວແກັດ, ເສີມຄວາມງາມ, ເຄື່ອງປັ່ນໝາກໄມ້-ພືດຜັກ',
          date '2026-06-01', date '2026-08-31', 'department', array['2011','2061'],
          'ບັນລຸ 80% ຂຶ້ນໄປ ເບີກໄດ້ເລີຍ · ເບີກຈາກງົບການຕະຫຼາດບໍລິສັດ', 'excel-import')
  returning id into cid;
  insert into app_campaign_line (campaign_id, name, categories, sort_order)
  values (cid, 'ເຄື່ອງໃຊ້ພາຍໃນຄົວ', array['022','024','025','020','358','356','306'], 1)
  returning id into lid;
  insert into app_campaign_tier (line_id, pct, target_qty, bonus_amount) values
    (lid, 100, 2500, 7000), (lid, 90, 2300, 6300), (lid, 80, 1850, 5040);

  -- 2. ໝໍ້ຫຸງເຂົ້າ / ໄມໂຄເວບ / ເຕົາລີດ ------------------------------------
  insert into app_campaign (name, description, date_from, date_to, scope_kind, scope_codes, note, created_by)
  values ('ຂາຍໝໍ້ຫຸງເຂົ້າ · ໄມໂຄເວບ · ເຕົາລີດ (ໄຕມາດ)',
          'ສາມໝວດແຍກເປົ້າກັນ · ໝໍ້ຫຸງເຂົ້າ MIDEA ລຸ້ນໃດກໍ່ໄດ້ ຮັບເພີ່ມ 5 ບາດ/ຕົວ',
          date '2026-06-01', date '2026-08-31', 'department', array['2011','2061'],
          'ບັນລຸ 90% ຂຶ້ນໄປ ເບີກໄດ້ເລີຍ · ເບີກຈາກງົບການຕະຫຼາດບໍລິສັດ', 'excel-import')
  returning id into cid;

  insert into app_campaign_line (campaign_id, name, categories, unit_bonus_brands, unit_bonus_per_unit, sort_order)
  values (cid, 'ໝໍ້ຫຸງເຂົ້າ', array['014'], array['MIDEA'], 5, 1) returning id into lid;
  insert into app_campaign_tier (line_id, pct, target_qty, bonus_amount) values
    (lid, 100, 400, 1800), (lid, 90, 360, 1620);

  insert into app_campaign_line (campaign_id, name, categories, sort_order)
  values (cid, 'ໄມໂຄເວບ', array['026'], 2) returning id into lid;
  insert into app_campaign_tier (line_id, pct, target_qty, bonus_amount) values
    (lid, 100, 250, 1700), (lid, 90, 225, 1500);

  insert into app_campaign_line (campaign_id, name, categories, sort_order)
  values (cid, 'ເຕົາລີດ', array['023'], 3) returning id into lid;
  insert into app_campaign_tier (line_id, pct, target_qty, bonus_amount) values
    (lid, 100, 400, 1000), (lid, 90, 360, 900);

  -- 3. ພັດລົມ ---------------------------------------------------------------
  insert into app_campaign (name, description, date_from, date_to, scope_kind, scope_codes, note, created_by)
  values ('ຂາຍພັດລົມ', 'ໝວດ ພັດລົມ (ລວມ ມ່ານອາກາດ ຢູ່ກຸ່ມດຽວກັນ — ຖ້າບໍ່ນັບໃຫ້ຖອດອອກ)',
          date '2026-06-01', date '2026-08-31', 'department', array['2011','2061'],
          'ບັນລຸ 80% ຂຶ້ນໄປ ເບີກໄດ້ເລີຍ · ເບີກຈາກງົບການຕະຫຼາດບໍລິສັດ', 'excel-import')
  returning id into cid;
  insert into app_campaign_line (campaign_id, name, categories, sort_order)
  values (cid, 'ພັດລົມ', array['013'], 1) returning id into lid;
  insert into app_campaign_tier (line_id, pct, target_qty, bonus_amount) values
    (lid, 100, 500, 3600), (lid, 90, 450, 3300), (lid, 80, 400, 2600);

  -- 4. ເຄື່ອງເຮັດນ້ຳອຸ່ນ Q3 --------------------------------------------------
  insert into app_campaign (name, description, date_from, date_to, scope_kind, scope_codes, note, created_by)
  values ('ຂາຍເຄື່ອງເຮັດນ້ຳອຸ່ນ Q3', 'ລຸ້ນໃດກໍ່ໄດ້ · CENTON ຮັບເພີ່ມ 5 ບາດ/ຕົວ',
          date '2026-07-01', date '2026-09-30', 'department', array['2011','2061'],
          'ບັນລຸ 80% ຂຶ້ນໄປ ເບີກໄດ້ເລີຍ · ເບີກຈາກງົບການຕະຫຼາດບໍລິສັດ', 'excel-import')
  returning id into cid;
  insert into app_campaign_line (campaign_id, name, categories, unit_bonus_brands, unit_bonus_per_unit, sort_order)
  values (cid, 'ເຄື່ອງເຮັດນ້ຳອຸ່ນ', array['021'], array['CENTON'], 5, 1) returning id into lid;
  insert into app_campaign_tier (line_id, pct, target_qty, bonus_amount) values
    (lid, 120, 4500, 28000), (lid, 110, 3800, 23000), (lid, 100, 3000, 20000),
    (lid, 90, 2700, 18000), (lid, 80, 2400, 16000);
end $$;
