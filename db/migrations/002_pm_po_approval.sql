-- PO approval workflow + attachments (app-owned; ic_trans holds the PO itself).
-- status: draft → pending → approved | rejected. wpoa_no = SML approval doc (trans_flag 8).

CREATE TABLE IF NOT EXISTS odg_pm_po_approval (
  doc_no        varchar(30) PRIMARY KEY,      -- PO doc_no in ic_trans (POH/POT)
  status        varchar(12) NOT NULL DEFAULT 'draft',
  wpoa_no       varchar(30),
  submitted_by  varchar(50),
  submitted_at  timestamptz,
  approved_by   varchar(50),
  approved_at   timestamptz,
  reject_reason text,
  created_by    varchar(50) NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS odg_pm_po_attachment (
  id           bigserial PRIMARY KEY,
  doc_no       varchar(30) NOT NULL,          -- PO doc_no
  kind         varchar(16) NOT NULL DEFAULT 'document', -- 'plan' | 'document'
  file_name    varchar(255) NOT NULL,
  file_path    text NOT NULL,                 -- relative path under storage/po
  content_type varchar(120),
  size_bytes   bigint,
  uploaded_by  varchar(50) NOT NULL,
  uploaded_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS odg_pm_po_attachment_doc_idx
  ON odg_pm_po_attachment (doc_no);
