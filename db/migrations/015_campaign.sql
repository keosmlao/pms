-- ໂຄງການສົ່ງເສີມການຂາຍ (sales incentive campaigns)
--
-- Unit-target tiered team bonuses ("ໃບຢັ້ງຢືນສົ່ງເສີມການຂາຍ"), separate from the
-- retail points/commission engine in app_incentive_*. Actuals come from
-- odg_sale_detail (qty already carries returns as negative rows).

create table if not exists app_campaign (
  id serial primary key,
  name text not null,
  description text,
  date_from date not null,
  date_to date not null,
  -- 'all' = every department; 'department' / 'bu' = restrict to scope_codes
  scope_kind text not null default 'all',
  scope_codes text[] not null default '{}',
  reward_currency text not null default 'THB',
  status text not null default 'active', -- draft | active | closed
  note text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One target line inside a campaign (e.g. ໝໍ້ຫຸງເຂົ້າ). `categories` holds
-- odg_sale_detail.item_category codes; `brands` optionally narrows the line.
-- unit_bonus_* is the flat "N ບາດ/ຕົວ ຂອງແບຣນ X" clause.
create table if not exists app_campaign_line (
  id serial primary key,
  campaign_id integer not null references app_campaign(id) on delete cascade,
  name text not null,
  categories text[] not null default '{}',
  brands text[] not null default '{}',
  unit_bonus_brands text[] not null default '{}',
  unit_bonus_per_unit numeric not null default 0,
  sort_order integer not null default 0
);

-- Achievement tiers, highest first. `pct` is the label printed on the sheet;
-- the real achievement ratio is target_qty / (100%-tier target_qty).
create table if not exists app_campaign_tier (
  id serial primary key,
  line_id integer not null references app_campaign_line(id) on delete cascade,
  pct numeric not null,
  target_qty numeric not null,
  bonus_amount numeric not null
);

create index if not exists app_campaign_line_campaign_idx on app_campaign_line (campaign_id);
create index if not exists app_campaign_tier_line_idx on app_campaign_tier (line_id);

-- 2026-08-22: ນັບສະເພາະ "ຕົວທີ່ຂາຍຈິງ" — ຕັດຂອງແຖມ (ລາຄາ 0 ຫຼື maingroup_code 98)
-- ອອກຈາກຍອດແຄມເປນ ຄືກັບກົດຂອງ odg_promo_campaign ໃນແອັບ SALE.
alter table app_campaign add column if not exists exclude_gifts boolean not null default true;

-- 2026-08-22: ວິທີແບ່ງເງິນໂບນັດຂອງທີມໃຫ້ພະນັກງານແຕ່ລະຄົນ ເພື່ອໃຫ້ຝ່າຍຂາຍເຫັນ
-- "ຂ້ອຍຈະໄດ້ເທົ່າໃດ" — 'prorata' (ຕາມສັດສ່ວນຍອດ, ຄ່າເລີ່ມຕົ້ນ) · 'equal'
-- (ແບ່ງເທົ່າກັນທຸກຄົນທີ່ມີຍອດ) · 'none' (ບໍ່ແບ່ງ — ເປັນເງິນທີມ).
-- ໝາຍເຫດ: ໂບນັດຕໍ່ຕົວຂອງແບຣນ (MIDEA/CENTON) ຄິດຕາມຍອດຈິງຂອງແຕ່ລະຄົນສະເໝີ
-- ບໍ່ຂຶ້ນກັບ split_rule.
alter table app_campaign add column if not exists split_rule text not null default 'prorata';

-- 2026-08-22: ຄົນທີ່ຊື່ໃນບິນຈັບຄູ່ກັບ odg_employee ບໍ່ໄດ້ (ແລະ ບໍ່ມີ alias)
-- ໃຫ້ຍອດ ແລະ ເງິນຂອງລາວ ຕົກເປັນຂອງ "ຫົວໜ້າທີມ" ຄົນນີ້ ແທນທີ່ຈະຫາຍໄປ.
alter table app_campaign add column if not exists fallback_employee_code text not null default '';
