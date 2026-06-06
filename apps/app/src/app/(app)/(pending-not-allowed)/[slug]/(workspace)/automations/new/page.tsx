import { auth } from "@vendor/clerk/server";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { AutomationCreateForm } from "./_components/automation-create-form";

export const dynamic = "force-dynamic";

export default async function NewAutomationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();

  if (!session.has({ role: "org:admin" })) {
    redirect(`/${slug}/automations` as Route);
  }

  return <AutomationCreateForm slug={slug} />;
}
