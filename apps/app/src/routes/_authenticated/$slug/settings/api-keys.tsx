import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceRoutePending } from "~/components/route-boundaries";
import { OrgApiKeyCreate } from "~/org/settings/api-keys/org-api-key-create";
import { OrgApiKeyList } from "~/org/settings/api-keys/org-api-key-list";

export const Route = createFileRoute("/_authenticated/$slug/settings/api-keys")(
  {
    head: ({ params }) => ({
      meta: [
        { title: `API Keys - ${params.slug} - Lightfast` },
        {
          name: "description",
          content: "Manage API keys for your Lightfast workspace.",
        },
      ],
    }),
    pendingMs: 0,
    pendingMinMs: 0,
    pendingComponent: ApiKeysRoutePending,
    component: ApiKeysSettingsPage,
  }
);

function ApiKeysRoutePending() {
  return <WorkspaceRoutePending label="Loading API keys" />;
}

function ApiKeysSettingsPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-medium font-title text-2xl text-foreground">
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
  );
}
