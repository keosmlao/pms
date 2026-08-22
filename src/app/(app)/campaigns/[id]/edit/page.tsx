import { notFound, redirect } from "next/navigation";
import { PageHeader, PageShell } from "@/components/PageShell";
import { getCampaignWithLines, listCategoryOptions, listChannelOptions, listDepartmentOptions, listEmployeeOptions } from "@/lib/campaigns";
import { getIsAdmin } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";
import CampaignForm, { type CampaignDraft } from "../../CampaignForm";
import { deleteCampaign } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !(await getIsAdmin(user.employeeCode))) redirect("/campaigns");
  const { id } = await params;
  const campaign = await getCampaignWithLines(Number(id));
  if (!campaign) notFound();

  const [categories, departments, employees, channels] = await Promise.all([
    listCategoryOptions(),
    listDepartmentOptions(),
    listEmployeeOptions(),
    listChannelOptions(),
  ]);

  const initial: CampaignDraft = {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description ?? "",
    date_from: campaign.date_from,
    date_to: campaign.date_to,
    scope_kind: campaign.scope_kind,
    scope_codes: campaign.scope_codes,
    reward_currency: campaign.reward_currency,
    status: campaign.status,
    note: campaign.note ?? "",
    exclude_gifts: campaign.exclude_gifts,
    split_rule: campaign.split_rule,
    fallback_employee_code: campaign.fallback_employee_code,
    channel_codes: campaign.channel_codes,
    lines: campaign.lines.map((l) => ({
      name: l.name,
      categories: l.categories,
      brands: l.brands.join(", "),
      unit_bonus_brands: l.unit_bonus_brands.join(", "),
      unit_bonus_per_unit: String(Number(l.unit_bonus_per_unit)),
      tiers: l.tiers.map((t) => ({
        pct: String(Number(t.pct)),
        target_qty: String(Number(t.target_qty)),
        bonus_amount: String(Number(t.bonus_amount)),
      })),
    })),
  };

  return (
    <PageShell>
      <PageHeader
        section="ໂຄງການສົ່ງເສີມການຂາຍ"
        title={`ແກ້ໄຂ: ${campaign.name}`}
        description="ບັນທຶກແລ້ວຈະຄິດໄລ່ຄວາມຄືບໜ້າໃໝ່ຈາກຍອດຂາຍຈິງທັນທີ"
        action={
          <form action={deleteCampaign}>
            <input type="hidden" name="id" value={campaign.id} />
            <button type="submit" className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:border-red-500/40 dark:hover:bg-red-500/10">
              ລຶບໂຄງການ
            </button>
          </form>
        }
      />
      <CampaignForm initial={initial} categories={categories} departments={departments} employees={employees} channels={channels} />
    </PageShell>
  );
}
