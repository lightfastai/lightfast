import { Suspense } from "react";
import { getQueryClient, HydrateClient, trpc } from "~/trpc/server";
import { McpConnectionsClient } from "./_components/mcp-connections-client";

export const dynamic = "force-dynamic";

export default async function OrgMcpSettingsPage() {
  await getQueryClient().fetchQuery(
    trpc.org.settings.mcpConnections.list.queryOptions()
  );

  return (
    <HydrateClient>
      <div className="space-y-8">
        <div>
          <h2 className="font-medium font-pp text-2xl text-foreground">
            MCP Connections
          </h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Review OAuth MCP clients connected to this organization.
          </p>
        </div>

        <Suspense fallback={null}>
          <McpConnectionsClient />
        </Suspense>
      </div>
    </HydrateClient>
  );
}
