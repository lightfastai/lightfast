import { getQueryClient, HydrateClient, trpc } from "~/trpc/server";
import { AutomationDetailClient } from "./_components/automation-detail-client";

export const dynamic = "force-dynamic";

export default async function AutomationDetailPage({
  params,
}: {
  params: Promise<{ slug: string; automationId: string }>;
}) {
  const { automationId: id } = await params;
  const qc = getQueryClient();

  await Promise.all([
    qc.fetchQuery(trpc.org.workspace.automations.get.queryOptions({ id })),
    qc.fetchQuery(
      trpc.org.workspace.automations.listRuns.queryOptions({ id, limit: 20 })
    ),
  ]);

  return (
    <HydrateClient>
      <AutomationDetailClient automationId={id} />
    </HydrateClient>
  );
}
