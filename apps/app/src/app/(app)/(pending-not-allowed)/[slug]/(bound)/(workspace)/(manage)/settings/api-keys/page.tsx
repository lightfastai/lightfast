import { HydrateClient, prefetch, trpc } from "@repo/app-trpc/server";
import { Suspense } from "react";
import { OrgApiKeyCreate } from "./_components/org-api-key-create";
import { OrgApiKeyList } from "./_components/org-api-key-list";
import { OrgApiKeyListLoading } from "./_components/org-api-key-list-loading";

export const dynamic = "force-dynamic";

export default function OrgApiKeysPage() {
  prefetch(trpc.pendingNotAllowed.orgApiKeys.list.queryOptions());

  return (
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

      <HydrateClient>
        <Suspense fallback={<OrgApiKeyListLoading />}>
          <OrgApiKeyList />
        </Suspense>
      </HydrateClient>
    </div>
  );
}
