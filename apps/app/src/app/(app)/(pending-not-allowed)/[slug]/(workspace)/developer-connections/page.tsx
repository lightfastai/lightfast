import { isDeveloperConnectionsEnabled } from "@api/app/feature-flags";
import { notFound } from "next/navigation";
import { getQueryClient, HydrateClient, trpc } from "~/trpc/server";
import { DeveloperConnectionsClient } from "./_components/developer-connections-client";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DeveloperConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    connection?: string | string[];
    error?: string | string[];
  }>;
}) {
  if (!(await isDeveloperConnectionsEnabled())) {
    notFound();
  }

  const params = await searchParams;

  await getQueryClient().fetchQuery(
    trpc.org.workspace.developerConnections.list.queryOptions()
  );

  return (
    <HydrateClient>
      <DeveloperConnectionsClient
        callbackError={firstParam(params.error)}
        callbackProvider={firstParam(params.connection)}
      />
    </HydrateClient>
  );
}
