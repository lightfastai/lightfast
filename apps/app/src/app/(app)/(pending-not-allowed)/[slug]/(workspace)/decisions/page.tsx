import { getQueryClient, HydrateClient, trpc } from "~/trpc/server";
import { DecisionsClient } from "./_components/decisions-client";

export const dynamic = "force-dynamic";

export default async function DecisionsPage() {
  await getQueryClient().fetchQuery(
    trpc.org.workspace.decisions.list.queryOptions({ limit: 50 })
  );

  return (
    <HydrateClient>
      <DecisionsClient />
    </HydrateClient>
  );
}
