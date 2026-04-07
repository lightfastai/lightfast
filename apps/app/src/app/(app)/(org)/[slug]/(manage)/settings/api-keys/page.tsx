import { HydrateClient, prefetch, trpc } from "@repo/app-trpc/server";
import { Suspense } from "react";
import { OrgApiKeyList } from "./_components/org-api-key-list";
import { OrgApiKeyListLoading } from "./_components/org-api-key-list-loading";
import { SecurityNotice } from "./_components/security-notice";

export const dynamic = "force-dynamic";

export default function OrgApiKeysPage() {
  prefetch(trpc.orgApiKeys.list.queryOptions());

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-medium font-pp text-2xl text-foreground">
          API Keys
        </h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Manage API keys for programmatic access to your organization's
          resources.
        </p>
      </div>

      <HydrateClient>
        <Suspense fallback={<OrgApiKeyListLoading />}>
          <OrgApiKeyList />
        </Suspense>
      </HydrateClient>

      <SecurityNotice />
    </div>
  );
}
