-- Odoo-style chatter for PO: messages/log, activities (to-do), followers.

CREATE TABLE IF NOT EXISTS odg_pm_po_comment (
  id         bigserial PRIMARY KEY,
  doc_no     varchar(30) NOT NULL,
  kind       varchar(12) NOT NULL DEFAULT 'comment', -- 'comment' | 'log'
  body       text NOT NULL,
  created_by varchar(50) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS odg_pm_po_comment_doc_idx ON odg_pm_po_comment (doc_no, created_at DESC);

CREATE TABLE IF NOT EXISTS odg_pm_po_activity (
  id         bigserial PRIMARY KEY,
  doc_no     varchar(30) NOT NULL,
  title      varchar(255) NOT NULL,
  assignee   varchar(50),
  due_date   date,
  status     varchar(10) NOT NULL DEFAULT 'open', -- 'open' | 'done'
  created_by varchar(50) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  done_at    timestamptz
);
CREATE INDEX IF NOT EXISTS odg_pm_po_activity_doc_idx ON odg_pm_po_activity (doc_no);

CREATE TABLE IF NOT EXISTS odg_pm_po_follower (
  doc_no        varchar(30) NOT NULL,
  employee_code varchar(50) NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (doc_no, employee_code)
);
