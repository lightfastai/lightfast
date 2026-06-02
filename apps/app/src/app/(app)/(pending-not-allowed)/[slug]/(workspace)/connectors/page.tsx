import { getQueryClient, HydrateClient, trpc } from "~/trpc/server";
import { ConnectorsClient } from "./_components/connectors-client";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ConnectorsPage({
  searchParams,
}: {
  searchParams: Promise<{
    connector?: string | string[];
    error?: string | string[];
  }>;
}) {
  const params = await searchParams;

  await getQueryClient().fetchQuery(
    trpc.org.workspace.connectors.list.queryOptions()
  );

  return (
    <HydrateClient>
      <ConnectorsClient
        callbackConnector={firstParam(params.connector)}
        callbackError={firstParam(params.error)}
      />
    </HydrateClient>
  );
}
