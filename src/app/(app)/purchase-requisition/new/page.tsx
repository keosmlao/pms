import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getDepartments, getEmployeeDepartment } from "@/lib/purchase-order";
import PrForm from "../PrForm";

export const dynamic = "force-dynamic";

export default async function NewPrPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [departments, defaultDept] = await Promise.all([getDepartments(), getEmployeeDepartment(user.employeeCode)]);
  return <PrForm departments={departments} defaultDept={defaultDept} requester={{ code: user.employeeCode, name: user.fullname }} />;
}
