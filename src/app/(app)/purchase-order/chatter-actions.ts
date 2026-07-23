"use server";

import { revalidatePath } from "next/cache";
import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export type ChatterState = { error: string | null; success: string | null };
const rev = (docNo: string) => revalidatePath(`/purchase-order/${encodeURIComponent(docNo)}`);

export async function addPoComment(_p: ChatterState, formData: FormData): Promise<ChatterState> {
  const user = await getCurrentUser();
  if (!user) return { error: "ກະລຸນາເຂົ້າລະບົບ", success: null };
  const docNo = String(formData.get("doc_no") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!docNo || !body) return { error: "ກະລຸນາພິມຂໍ້ຄວາມ", success: null };
  await pool.query(
    `INSERT INTO odg_pm_po_comment (doc_no, kind, body, created_by) VALUES ($1,'comment',$2,$3)`,
    [docNo, body.slice(0, 2000), user.employeeCode],
  );
  rev(docNo);
  return { error: null, success: null };
}

export async function deletePoComment(_p: ChatterState, formData: FormData): Promise<ChatterState> {
  const user = await getCurrentUser();
  if (!user) return { error: "ກະລຸນາເຂົ້າລະບົບ", success: null };
  const id = Number(formData.get("id"));
  const docNo = String(formData.get("doc_no") ?? "").trim();
  if (!Number.isFinite(id)) return { error: null, success: null };
  await pool.query(`DELETE FROM odg_pm_po_comment WHERE id=$1 AND created_by=$2 AND kind='comment'`, [id, user.employeeCode]);
  rev(docNo);
  return { error: null, success: null };
}

export async function addPoActivity(_p: ChatterState, formData: FormData): Promise<ChatterState> {
  const user = await getCurrentUser();
  if (!user) return { error: "ກະລຸນາເຂົ້າລະບົບ", success: null };
  const docNo = String(formData.get("doc_no") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const assignee = String(formData.get("assignee") ?? "").trim();
  const dueDate = String(formData.get("due_date") ?? "").trim();
  if (!docNo || !title) return { error: "ກະລຸນາພິມຫົວຂໍ້ວຽກ", success: null };
  await pool.query(
    `INSERT INTO odg_pm_po_activity (doc_no, title, assignee, due_date, created_by)
     VALUES ($1,$2,NULLIF($3,''),NULLIF($4,'')::date,$5)`,
    [docNo, title.slice(0, 255), assignee, dueDate, user.employeeCode],
  );
  rev(docNo);
  return { error: null, success: "ເພີ່ມວຽກແລ້ວ" };
}

export async function togglePoActivity(_p: ChatterState, formData: FormData): Promise<ChatterState> {
  const user = await getCurrentUser();
  if (!user) return { error: "ກະລຸນາເຂົ້າລະບົບ", success: null };
  const id = Number(formData.get("id"));
  const docNo = String(formData.get("doc_no") ?? "").trim();
  if (!Number.isFinite(id)) return { error: null, success: null };
  await pool.query(
    `UPDATE odg_pm_po_activity
        SET status = CASE WHEN status='done' THEN 'open' ELSE 'done' END,
            done_at = CASE WHEN status='done' THEN NULL ELSE now() END
      WHERE id=$1`,
    [id],
  );
  rev(docNo);
  return { error: null, success: null };
}

export async function toggleFollow(_p: ChatterState, formData: FormData): Promise<ChatterState> {
  const user = await getCurrentUser();
  if (!user) return { error: "ກະລຸນາເຂົ້າລະບົບ", success: null };
  const docNo = String(formData.get("doc_no") ?? "").trim();
  if (!docNo) return { error: null, success: null };
  const existing = await pool.query(
    `SELECT 1 FROM odg_pm_po_follower WHERE doc_no=$1 AND employee_code=$2`,
    [docNo, user.employeeCode],
  );
  if ((existing.rowCount ?? 0) > 0) {
    await pool.query(`DELETE FROM odg_pm_po_follower WHERE doc_no=$1 AND employee_code=$2`, [docNo, user.employeeCode]);
  } else {
    await pool.query(`INSERT INTO odg_pm_po_follower (doc_no, employee_code) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [docNo, user.employeeCode]);
  }
  rev(docNo);
  return { error: null, success: null };
}
