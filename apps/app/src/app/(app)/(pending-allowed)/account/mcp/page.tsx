import { Suspense } from "react";
import { getQueryClient, HydrateClient, trpc } from "~/trpc/server";
import { UserMcpConnectionsClient } from "./_components/user-mcp-connections-client";

export const dynamic = "force-dynamic";

export default async function AccountMcpPage() {
  await getQueryClient().fetchQuery(
    trpc.viewer.account.mcpConnections.list.queryOptions()
  );

  return (
    <HydrateClient>
      <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-8">
        <div>
          <h1 className="font-medium font-pp text-2xl text-foreground">
            MCP Connections
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Manage MCP clients authorized for your account.
          </p>
        </div>

        <Suspense fallback={null}>
          <UserMcpConnectionsClient />
        </Suspense>
      </div>
    </HydrateClient>
  );
}
