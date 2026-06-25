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
    Object.entries(search).flatMap(([key, value]) => {
      const normalized = singleSearchValue(value);
      return normalized ? [[key, normalized]] : [];
    })
  ) as Record<string, string | undefined>;
}

function singleSearchValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  if (!Array.isArray(value)) {
    return;
  }

  const values = value.filter(
    (item): item is string => typeof item === "string" && item.length > 0
  );
  const [first] = values;
  if (!first || values.some((item) => item !== first)) {
    return;
  }
  return first;
}
