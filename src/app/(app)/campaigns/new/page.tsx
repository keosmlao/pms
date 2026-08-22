import { redirect } from "next/navigation";
import { PageHeader, PageShell } from "@/components/PageShell";
import { listCategoryOptions, listChannelOptions, listDepartmentOptions, listEmployeeOptions } from "@/lib/campaigns";
import { getIsAdmin } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";
import CampaignForm, { type CampaignDraft } from "../CampaignForm";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  const user = await getCurrentUser();
  if (!user || !(await getIsAdmin(user.employeeCode))) redirect("/campaigns");
  const [categories, departments, employees, channels] = await Promise.all([
    listCategoryOptions(),
    listDepartmentOptions(),
    listEmployeeOptions(),
    listChannelOptions(),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const initial: CampaignDraft = {
    name: "",
    description: "",
    date_from: today,
    date_to: today,
    scope_kind: "all",
    scope_codes: [],
    reward_currency: "THB",
    status: "active",
    note: "",
    exclude_gifts: true,
    split_rule: "prorata",
    fallback_employee_code: "",
    channel_codes: ["102"],
    lines: [
      { name: "", categories: [], brands: "", unit_bonus_brands: "", unit_bonus_per_unit: "0", tiers: [{ pct: "100", target_qty: "", bonus_amount: "" }] },
    ],
  };

  return (
    <PageShell>
      <PageHeader section="ໂຄງການສົ່ງເສີມການຂາຍ" title="ສ້າງໂຄງການໃໝ່" description="ກຳນົດໄລຍະເວລາ, ໝວດສິນຄ້າທີ່ນັບເຂົ້າເປົ້າ ແລະ ຂັ້ນໂບນັດ" />
      <CampaignForm initial={initial} categories={categories} departments={departments} employees={employees} channels={channels} />
    </PageShell>
  );
}
