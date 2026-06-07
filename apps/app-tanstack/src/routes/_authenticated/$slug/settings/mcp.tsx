import { createFileRoute } from "@tanstack/react-router";
import { McpConnectionsClient } from "~/org/settings/mcp/mcp-connections-client";
import {
  loadRoutePrefetch,
  RoutePrefetchBoundary,
} from "~/trpc/route-prefetch";

export const Route = createFileRoute("/_authenticated/$slug/settings/mcp")({
  loader: () => loadRoutePrefetch({ data: { route: "org.mcp" } }),
  head: ({ params }) => ({
    meta: [
      { title: `MCP Connections - ${params.slug} - Lightfast` },
      {
        name: "description",
        content: "Review OAuth MCP clients connected to this workspace.",
      },
    ],
  }),
  component: McpSettingsPage,
});

function McpSettingsPage() {
  const prefetchState = Route.useLoaderData();

  return (
    <RoutePrefetchBoundary state={prefetchState}>
      <div className="space-y-8">
        <div>
          <h2 className="font-medium font-pp text-2xl text-foreground">
            MCP Connections
          </h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Review OAuth MCP clients connected to this organization.
          </p>
        </div>

        <McpConnectionsClient />
      </div>
    </RoutePrefetchBoundary>
  );
}
