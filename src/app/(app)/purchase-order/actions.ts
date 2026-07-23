"use server";

import { revalidatePath } from "next/cache";
import {
  createPurchaseOrder,
  type CreatePoInput,
  type PoFormat,
  PO_FORMATS,
} from "@/lib/purchase-order";
import { getCurrentUser } from "@/lib/session";

export type PoState = { error: string | null; doc_no: string | null };

export async function createPoAction(
  _prev: PoState,
  formData: FormData,
): Promise<PoState> {
  const user = await getCurrentUser();
  if (!user) return { error: "ກະລຸນາເຂົ້າສູ່ລະບົບ", doc_no: null };

  let payload: CreatePoInput;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? "{}")) as CreatePoInput;
  } catch {
    return { error: "ຂໍ້ມູນຟອມບໍ່ຖືກຕ້ອງ", doc_no: null };
  }

  if (!PO_FORMATS.some((f) => f.code === payload.format)) {
    return { error: "ຕ້ອງເລືອກຮູບແບບ PO (POH/POT)", doc_no: null };
  }

  const input: CreatePoInput = {
    format: payload.format as PoFormat,
    supplier_code: String(payload.supplier_code ?? "").trim(),
    currency_code: String(payload.currency_code ?? "01").trim() || "01",
    exchange_rate: Number(payload.exchange_rate) || 1,
    vat: String(payload.vat ?? "none"),
    wh_code: String(payload.wh_code ?? "").trim(),
    department_code: String(payload.department_code ?? "").trim(),
    eta: String(payload.eta ?? "").trim(),
    credit_day: Number(payload.credit_day) || 0,
    remark: String(payload.remark ?? "").trim(),
    lines: Array.isArray(payload.lines)
      ? payload.lines.map((l) => ({
          item_code: String(l.item_code ?? "").trim(),
          item_name: String(l.item_name ?? "").trim(),
          unit: String(l.unit ?? "").trim(),
          qty: Number(l.qty) || 0,
          price: Number(l.price) || 0,
          wh_code: String(l.wh_code ?? "").trim(),
          stand_value: Number(l.stand_value) || 1,
          divide_value: Number(l.divide_value) || 1,
          ref_doc_no: String(l.ref_doc_no ?? "").trim(),
          ref_line: Number(l.ref_line) || 0,
        }))
      : [],
  };

  const result = await createPurchaseOrder(input, { employeeCode: user.employeeCode });
  if (!result.ok) return { error: result.error, doc_no: null };

  // Save any files attached on the create form to the new PO.
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > 0) {
    const kind = String(formData.get("kind") ?? "plan") || "plan";
    await saveFiles(result.doc_no, kind, files, user.employeeCode);
  }

  revalidatePath("/purchase-order");
  // Land straight on the record page (Odoo-style): chatter + attachments live there.
  redirect(`/purchase-order/${encodeURIComponent(result.doc_no)}?created=1`);
}

// ===== attachments + approval workflow =====
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import {
  addAttachmentRecord,
  approvePurchaseOrder,
  deleteAttachment,
  logPoEvent,
  rejectPurchaseOrder,
  revokeApproval,
  submitForApproval,
} from "@/lib/purchase-order";
import { getIsAdmin } from "@/lib/products";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "po");
const MAX_FILE = 20 * 1024 * 1024; // 20MB

// Save uploaded files to storage/po/<docNo> and record them. Oversized files are skipped.
async function saveFiles(docNo: string, kind: string, files: File[], employeeCode: string): Promise<void> {
  const valid = files.filter((f) => f instanceof File && f.size > 0 && f.size <= MAX_FILE);
  if (valid.length === 0) return;
  const dir = path.join(STORAGE_ROOT, docNo);
  await mkdir(dir, { recursive: true });
  for (const file of valid) {
    const safe = file.name.replace(/[^\w.\-຀-໿ ]+/g, "_").slice(0, 180);
    const stored = `${randomUUID()}__${safe}`;
    await writeFile(path.join(dir, stored), Buffer.from(await file.arrayBuffer()));
    await addAttachmentRecord(
      docNo,
      { kind, file_name: file.name, file_path: path.join(docNo, stored), content_type: file.type || "application/octet-stream", size_bytes: file.size },
      { employeeCode },
    );
  }
}

export type UploadState = { error: string | null; ok: boolean };

export async function uploadAttachmentAction(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const user = await getCurrentUser();
  if (!user) return { error: "ກະລຸນາເຂົ້າສູ່ລະບົບ", ok: false };

  const docNo = String(formData.get("doc_no") ?? "").trim();
  const kind = String(formData.get("kind") ?? "document").trim() || "document";
  if (!docNo) return { error: "ບໍ່ພົບ PO", ok: false };

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "ກະລຸນາເລືອກໄຟລ໌", ok: false };

  const dir = path.join(STORAGE_ROOT, docNo);
  await mkdir(dir, { recursive: true });

  for (const file of files) {
    if (file.size > MAX_FILE) return { error: `ໄຟລ໌ "${file.name}" ໃຫຍ່ເກີນ 20MB`, ok: false };
    const safe = file.name.replace(/[^\w.\-຀-໿ ]+/g, "_").slice(0, 180);
    const stored = `${randomUUID()}__${safe}`;
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, stored), buf);
    await addAttachmentRecord(
      docNo,
      {
        kind,
        file_name: file.name,
        file_path: path.join(docNo, stored),
        content_type: file.type || "application/octet-stream",
        size_bytes: file.size,
      },
      { employeeCode: user.employeeCode },
    );
  }

  revalidatePath(`/purchase-order/${docNo}`);
  return { error: null, ok: true };
}

export async function deleteAttachmentAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const id = Number(formData.get("id"));
  const docNo = String(formData.get("doc_no") ?? "");
  if (!Number.isFinite(id)) return;
  const rel = await deleteAttachment(id);
  if (rel) {
    await unlink(path.join(STORAGE_ROOT, rel)).catch(() => {});
  }
  revalidatePath(`/purchase-order/${docNo}`);
}

export async function submitApprovalAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const docNo = String(formData.get("doc_no") ?? "").trim();
  if (!docNo) return;
  const res = await submitForApproval(docNo, { employeeCode: user!.employeeCode });
  if (res.ok) await logPoEvent(docNo, `ສົ່ງຂໍອະນຸມັດ${res.wpoa_no ? ` · ${res.wpoa_no}` : ""}`, user!.employeeCode);
  const params = res.ok ? "submitted=1" : `err=${encodeURIComponent(res.error)}`;
  revalidatePath(`/purchase-order/${docNo}`);
  redirect(`/purchase-order/${docNo}?${params}`);
}

export async function approveAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const isAdmin = await getIsAdmin(user!.employeeCode);
  const docNo = String(formData.get("doc_no") ?? "").trim();
  if (!docNo) return;
  if (!isAdmin) {
    redirect(`/purchase-order/${docNo}?err=${encodeURIComponent("ບໍ່ມີສິດອະນຸມັດ")}`);
  }
  const res = await approvePurchaseOrder(docNo, { employeeCode: user!.employeeCode });
  if (res.ok) await logPoEvent(docNo, `ອະນຸມັດ PO${res.poa_no ? ` · ${res.poa_no}` : ""}`, user!.employeeCode);
  const params = res.ok ? "approved=1" : `err=${encodeURIComponent(res.error)}`;
  revalidatePath(`/purchase-order/${docNo}`);
  revalidatePath("/purchase-order");
  redirect(`/purchase-order/${docNo}?${params}`);
}

export async function rejectAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const isAdmin = await getIsAdmin(user!.employeeCode);
  const docNo = String(formData.get("doc_no") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!docNo) return;
  if (!isAdmin) {
    redirect(`/purchase-order/${docNo}?err=${encodeURIComponent("ບໍ່ມີສິດ")}`);
  }
  await rejectPurchaseOrder(docNo, reason, { employeeCode: user!.employeeCode });
  await logPoEvent(docNo, `ປະຕິເສດ: ${reason || "—"}`, user!.employeeCode);
  revalidatePath(`/purchase-order/${docNo}`);
  redirect(`/purchase-order/${docNo}?rejected=1`);
}

export async function revokeApprovalAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const isAdmin = await getIsAdmin(user!.employeeCode);
  const docNo = String(formData.get("doc_no") ?? "").trim();
  if (!docNo) return;
  if (!isAdmin) {
    redirect(`/purchase-order/${docNo}?err=${encodeURIComponent("ບໍ່ມີສິດ")}`);
  }
  const res = await revokeApproval(docNo);
  if (res.ok) await logPoEvent(docNo, `ຍົກເລີກອະນຸມັດ${res.poa_no ? ` · ລົບ ${res.poa_no}` : ""}`, user!.employeeCode);
  revalidatePath(`/purchase-order/${docNo}`);
  revalidatePath("/purchase-order");
  redirect(`/purchase-order/${docNo}?revoked=1`);
}
