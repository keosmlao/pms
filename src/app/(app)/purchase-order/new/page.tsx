import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getDepartments, getEmployeeDepartment, getWarehouses, PO_CURRENCIES, PO_FORMATS, PO_VAT_OPTIONS } from "@/lib/purchase-order";
import { getPrForConvert } from "@/lib/purchase-requisition";
import PoForm from "../PoForm";

export const dynamic = "force-dynamic";

export default async function NewPurchaseOrderPage({ searchParams }: { searchParams: Promise<{ pr?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const prId = Number((await searchParams).pr);
  const [warehouses, departments, defaultDept, prData] = await Promise.all([
    getWarehouses(),
    getDepartments(),
    getEmployeeDepartment(user.employeeCode),
    Number.isFinite(prId) && prId > 0 ? getPrForConvert(prId) : Promise.resolve(null),
  ]);

  const initialLines = prData?.lines.map((l) => ({
    item_code: l.item_code, item_name: l.item_name, unit: l.unit, qty: l.qty, price: l.est_price,
  }));

  return (
    <PoForm
      warehouses={warehouses}
      departments={departments}
      defaultDept={defaultDept}
      formats={PO_FORMATS}
      currencies={PO_CURRENCIES}
      vatOptions={PO_VAT_OPTIONS}
      requester={{ code: user.employeeCode, name: user.fullname }}
      initialLines={initialLines}
      prId={prData ? prId : undefined}
    />
  );
}
