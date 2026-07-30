-- Internal Purchase Requisition (ໃບຂໍຊື້): a department requests to buy →
-- approval → converts to a PO (where the vendor + price are chosen).
-- Header + lines. Lines may reference an ERP item or be free text (new item).

CREATE TABLE IF NOT EXISTS odg_pm_pr (
  id              bigserial PRIMARY KEY,
  pr_no           varchar(20) UNIQUE NOT NULL,          -- PR<YY><MM><NNNN>
  doc_date        date NOT NULL DEFAULT CURRENT_DATE,
  department_code varchar(20),
  requester_code  varchar(50) NOT NULL,
  need_date       date,                                 -- ວັນທີຕ້ອງການ
  note            text,
  status          varchar(12) NOT NULL DEFAULT 'draft', -- draft | pending | approved | rejected | converted
  reject_reason   text,
  approved_by     varchar(50),
  approved_at     timestamptz,
  po_no           varchar(30),                          -- set when converted
  created_by      varchar(50) NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS odg_pm_pr_line (
  id         bigserial PRIMARY KEY,
  pr_id      bigint NOT NULL REFERENCES odg_pm_pr(id) ON DELETE CASCADE,
  line_no    int NOT NULL,
  item_code  varchar(30),               -- null = free-text / new item
  item_name  varchar(200) NOT NULL,
  unit       varchar(30),
  qty        numeric NOT NULL DEFAULT 0,
  est_price  numeric DEFAULT 0,         -- ລາຄາປະມານ (optional)
  note       varchar(200)
);

CREATE INDEX IF NOT EXISTS idx_pm_pr_status ON odg_pm_pr (status, doc_date DESC);
CREATE INDEX IF NOT EXISTS idx_pm_pr_line_pr ON odg_pm_pr_line (pr_id);
