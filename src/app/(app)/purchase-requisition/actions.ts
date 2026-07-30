"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { approvePr, createPr, rejectPr, submitPr, type CreatePrInput } from "@/lib/purchase-requisition";
import { getIsAdmin } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";

export type PrState = { error: string | null; id: number | null };

export async function createPrAction(_prev: PrState, formData: FormData): Promise<PrState> {
  const user = await getCurrentUser();
  if (!user) return { error: "ກະລຸນາເຂົ້າສູ່ລະບົບ", id: null };

  let payload: CreatePrInput;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? "{}")) as CreatePrInput;
  } catch {
    return { error: "ຂໍ້ມູນຟອມບໍ່ຖືກຕ້ອງ", id: null };
  }

  const input: CreatePrInput = {
    department_code: String(payload.department_code ?? "").trim(),
    need_date: String(payload.need_date ?? "").trim(),
    note: String(payload.note ?? "").trim(),
    submit: String(formData.get("submit") ?? "") === "1",
    lines: Array.isArray(payload.lines)
      ? payload.lines.map((l) => ({
          item_code: String(l.item_code ?? "").trim(),
          item_name: String(l.item_name ?? "").trim(),
          unit: String(l.unit ?? "").trim(),
          qty: Number(l.qty) || 0,
          est_price: Number(l.est_price) || 0,
          note: String(l.note ?? "").trim(),
        }))
      : [],
  };

  const res = await createPr(input, { employeeCode: user.employeeCode });
  if (!res.ok) return { error: res.error, id: null };
  revalidatePath("/purchase-requisition");
  redirect(`/purchase-requisition/${res.id}?created=1`);
}

export async function submitPrAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const id = Number(formData.get("id"));
  if (Number.isFinite(id)) await submitPr(id);
  revalidatePath(`/purchase-requisition/${id}`);
  redirect(`/purchase-requisition/${id}?submitted=1`);
}

export async function approvePrAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const id = Number(formData.get("id"));
  if (!(await getIsAdmin(user.employeeCode))) {
    redirect(`/purchase-requisition/${id}?err=${encodeURIComponent("ບໍ່ມີສິດອະນຸມັດ")}`);
  }
  if (Number.isFinite(id)) await approvePr(id, { employeeCode: user.employeeCode });
  revalidatePath(`/purchase-requisition/${id}`);
  redirect(`/purchase-requisition/${id}?approved=1`);
}

export async function rejectPrAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const id = Number(formData.get("id"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!(await getIsAdmin(user.employeeCode))) {
    redirect(`/purchase-requisition/${id}?err=${encodeURIComponent("ບໍ່ມີສິດ")}`);
  }
  if (Number.isFinite(id)) await rejectPr(id, reason);
  revalidatePath(`/purchase-requisition/${id}`);
  redirect(`/purchase-requisition/${id}?rejected=1`);
}
