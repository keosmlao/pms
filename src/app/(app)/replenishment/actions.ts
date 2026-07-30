"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createPurchaseOrder, getWarehouses, getEmployeeDepartment, type CreatePoInput } from "@/lib/purchase-order";
import { getCurrentUser } from "@/lib/session";

type ReplenLine = { item_code: string; item_name: string; unit: string; qty: number; price: number; stand_value: number; divide_value: number };

// Create ONE draft PO for a supplier group from the replenishment plan.
export async function createReplenishmentPoAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supplierCode = String(formData.get("supplier_code") ?? "").trim();
  const currencyCode = String(formData.get("currency_code") ?? "01").trim() || "01";
  if (!supplierCode) {
    redirect(`/replenishment?err=${encodeURIComponent("ບໍ່ຮູ້ຜູ້ສະໜອງ — ເປີດ PO ດ້ວຍມື")}`);
  }

  let lines: ReplenLine[] = [];
  try {
    lines = JSON.parse(String(formData.get("lines") ?? "[]")) as ReplenLine[];
  } catch {
    redirect(`/replenishment?err=${encodeURIComponent("ຂໍ້ມູນລາຍການບໍ່ຖືກຕ້ອງ")}`);
  }
  lines = lines.filter((l) => l.item_code && Number(l.qty) > 0);
  if (lines.length === 0) redirect(`/replenishment?err=${encodeURIComponent("ບໍ່ມີລາຍການ")}`);

  const [warehouses, dept] = await Promise.all([getWarehouses(), getEmployeeDepartment(user.employeeCode)]);
  const wh = warehouses[0]?.code ?? "";

  const input: CreatePoInput = {
    format: "POH",
    supplier_code: supplierCode,
    currency_code: currencyCode,
    exchange_rate: 1,
    vat: "none",
    wh_code: wh,
    department_code: dept,
    eta: "",
    credit_day: 0,
    remark: "ສ້າງຈາກ ເຕີມສິນຄ້າອັດຕະໂນມັດ (min/max)",
    lines: lines.map((l) => ({
      item_code: l.item_code,
      item_name: l.item_name,
      unit: l.unit,
      qty: Number(l.qty) || 0,
      price: Number(l.price) || 0,
      wh_code: wh,
      stand_value: Number(l.stand_value) || 1,
      divide_value: Number(l.divide_value) || 1,
      ref_doc_no: "",
      ref_line: 0,
    })),
  };

  const result = await createPurchaseOrder(input, { employeeCode: user.employeeCode });
  if (!result.ok) redirect(`/replenishment?err=${encodeURIComponent(result.error)}`);
  revalidatePath("/purchase-order");
  redirect(`/purchase-order/${encodeURIComponent(result.doc_no)}?created=1`);
}
