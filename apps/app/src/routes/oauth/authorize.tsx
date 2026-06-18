import { loadMcpConsentViewModel } from "@api/app/tanstack/mcp-consent";
import { createFileRoute } from "@tanstack/react-router";
import { McpConsentCard } from "~/oauth/mcp-consent-card";

export const Route = createFileRoute("/oauth/authorize")({
  validateSearch: validateMcpAuthorizeSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => loadMcpConsentViewModel({ data: deps }),
  head: () => ({
    meta: [
      { title: "Authorize MCP Client - Lightfast" },
      {
        name: "description",
        content: "Review and approve MCP client access to Lightfast.",
      },
    ],
  }),
  component: McpAuthorizePage,
});

function McpAuthorizePage() {
  const model = Route.useLoaderData();
  return <McpConsentCard model={model} />;
}

function validateMcpAuthorizeSearch(search: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(search).flatMap(([key, value]) =>
      typeof value === "string" && value.length > 0 ? [[key, value]] : []
    )
  ) as Record<string, string | undefined>;
}
