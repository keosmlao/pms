import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getDepartments, getEmployeeDepartment, getWarehouses, PO_CURRENCIES, PO_FORMATS, PO_VAT_OPTIONS } from "@/lib/purchase-order";
import PoForm from "../PoForm";

export const dynamic = "force-dynamic";

export default async function NewPurchaseOrderPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [warehouses, departments, defaultDept] = await Promise.all([
    getWarehouses(),
    getDepartments(),
    getEmployeeDepartment(user.employeeCode),
  ]);

  return (
    <PoForm
      warehouses={warehouses}
      departments={departments}
      defaultDept={defaultDept}
      formats={PO_FORMATS}
      currencies={PO_CURRENCIES}
      vatOptions={PO_VAT_OPTIONS}
      requester={{ code: user.employeeCode, name: user.fullname }}
    />
  );
}
