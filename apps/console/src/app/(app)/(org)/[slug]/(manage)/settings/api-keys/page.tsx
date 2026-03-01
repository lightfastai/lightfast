import { Suspense } from "react";
import { HydrateClient, prefetch, orgTrpc } from "@repo/console-trpc/server";
import { OrgApiKeyList } from "./_components/org-api-key-list";
import { OrgApiKeyListLoading } from "./_components/org-api-key-list-loading";
import { SecurityNotice } from "./_components/security-notice";

/**
 * Organization API Keys Settings Page
 *
 * Server component with client islands for optimal SSR performance.
 * API keys are org-scoped and can access all workspaces.
 *
 * Architecture:
 * - Server components: Static headers, security notice, loading skeletons
 * - Client island: Interactive API key list with mutations
 * - Suspense boundary: Wraps only the data-fetching component
 */
export default function OrgApiKeysPage() {
  prefetch(orgTrpc.orgApiKeys.list.queryOptions());

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-pp font-medium text-foreground">
          API Keys
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage API keys for authenticating with Lightfast services. Keys can access all workspaces in your organization.
        </p>
      </div>

      <HydrateClient>
        <Suspense fallback={<OrgApiKeyListLoading />}>
          <OrgApiKeyList />
        </Suspense>
      </HydrateClient>

      {/* Static Security Notice */}
      <SecurityNotice />
    </div>
  );
}
