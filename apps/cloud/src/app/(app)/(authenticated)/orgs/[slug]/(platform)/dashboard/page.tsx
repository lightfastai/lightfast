import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { OrganizationDashboard } from "~/components/dashboard/organization-dashboard";

export default async function DashboardPage() {
  const { userId, orgId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  if (!orgId) {
    redirect("/select-organization");
  }

  return <OrganizationDashboard organizationId={orgId} />;
}