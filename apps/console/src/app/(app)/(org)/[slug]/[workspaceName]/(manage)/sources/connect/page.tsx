import { Suspense } from "react";
import { HydrateClient, prefetch, orgTrpc } from "@repo/console-trpc/server";
import { ConnectHeader } from "./_components/connect-header";
import { ConnectInitializer } from "./_components/connect-initializer";
import { ConnectLoading } from "./_components/connect-loading";

/**
 * Integration Connect Page
 *
 * Single-page flow for connecting new integrations to workspace.
 * Follows /new workspace creation pattern:
 * - Server component with prefetch
 * - nuqs for URL state (provider selection)
 * - Client islands for interactive sections
 */
export default async function ConnectPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; workspaceName: string }>;
  searchParams: Promise<{ provider?: string; connected?: string }>;
}) {
  const { slug, workspaceName } = await params;
  const { provider = "github", connected } = await searchParams;

  // Prefetch user sources for all providers (no waterfall)
  prefetch(orgTrpc.connections.github.get.queryOptions());
  prefetch(orgTrpc.connections.vercel.get.queryOptions());
  // TODO: Add prefetch for Linear and Sentry when available

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="min-h-full flex items-start justify-center py-12">
        <div className="w-full max-w-3xl px-6">
          {/* Static Header */}
          <ConnectHeader />

          <HydrateClient>
            <Suspense fallback={<ConnectLoading />}>
              <ConnectInitializer
                initialProvider={provider as "github" | "vercel" | "linear" | "sentry"}
                initialConnected={connected === "true"}
                clerkOrgSlug={slug}
                workspaceName={workspaceName}
              />
            </Suspense>
          </HydrateClient>
        </div>
      </div>
    </div>
  );
}
