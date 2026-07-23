-- POA approval doc number (POHA for POH / POTA for POT), created at approval time.
ALTER TABLE odg_pm_po_approval ADD COLUMN IF NOT EXISTS poa_no varchar(30);
