import { createFileRoute } from "@tanstack/react-router";
import { OrgApiKeyCreate } from "~/org/settings/api-keys/org-api-key-create";
import { OrgApiKeyList } from "~/org/settings/api-keys/org-api-key-list";
import {
  loadRoutePrefetch,
  RoutePrefetchBoundary,
} from "~/trpc/route-prefetch";

export const Route = createFileRoute("/_authenticated/$slug/settings/api-keys")(
  {
    loader: () =>
      loadRoutePrefetch({ data: { route: "org.settings.apiKeys" } }),
    head: ({ params }) => ({
      meta: [
        { title: `API Keys - ${params.slug} - Lightfast` },
        {
          name: "description",
          content: "Manage API keys for your Lightfast workspace.",
        },
      ],
    }),
    component: ApiKeysSettingsPage,
  }
);

function ApiKeysSettingsPage() {
  const prefetchState = Route.useLoaderData();

  return (
    <RoutePrefetchBoundary state={prefetchState}>
      <div className="space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-medium font-pp text-2xl text-foreground">
              API Keys
            </h2>
            <p className="mt-1 text-muted-foreground text-sm">
              Manage API keys for programmatic access to your organization's
              resources.
            </p>
          </div>
          <OrgApiKeyCreate />
        </div>

        <OrgApiKeyList />
      </div>
    </RoutePrefetchBoundary>
  );
}
