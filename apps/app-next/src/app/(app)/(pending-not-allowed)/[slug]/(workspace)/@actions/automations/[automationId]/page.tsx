import type { Route } from "next";
import { BackButton } from "~/components/back-button";

export default async function AutomationDetailActionsSlot({
  params,
}: {
  params: Promise<{ slug: string; automationId: string }>;
}) {
  const { slug } = await params;
  return (
    <BackButton href={`/${slug}/automations` as Route} label="Automations" />
  );
}
