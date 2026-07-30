import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { canManageIncentives } from "@/lib/roles";
import IncentiveSettingsClient from "./IncentiveSettingsClient";

export const dynamic = "force-dynamic";

export default async function IncentiveConfigPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const canManage = await canManageIncentives(user);
  return <IncentiveSettingsClient canManage={canManage} />;
}
