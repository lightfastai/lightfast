import { getQueryClient, HydrateClient, trpc } from "~/trpc/server";
import { AutomationsClient } from "./_components/automations-client";

export const dynamic = "force-dynamic";

export default async function AutomationsPage() {
  await getQueryClient().fetchQuery(
    trpc.org.workspace.automations.list.queryOptions()
  );

  return (
    <HydrateClient>
      <AutomationsClient />
    </HydrateClient>
  );
}
