import { AutomationCreateForm } from "./_components/automation-create-form";

export const dynamic = "force-dynamic";

export default async function NewAutomationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <AutomationCreateForm slug={slug} />;
}
