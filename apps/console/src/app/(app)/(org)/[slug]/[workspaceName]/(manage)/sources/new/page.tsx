import { PROVIDER_SLUGS } from "@repo/console-providers";
import { HydrateClient, orgTrpc, prefetch } from "@repo/console-trpc/server";
import { Suspense } from "react";
import { LinkSourcesButton } from "./_components/link-sources-button";
import { SourceSelectionProvider } from "./_components/source-selection-provider";
import { SourcesSection } from "./_components/sources-section";
import { SourcesSectionLoading } from "./_components/sources-section-loading";

export default async function AddSourcesPage({
  params,
}: {
  params: Promise<{ slug: string; workspaceName: string }>;
}) {
  const { slug, workspaceName } = await params;

  // Prefetch connection status for all providers
  for (const provider of PROVIDER_SLUGS) {
    void prefetch(
      orgTrpc.connections.generic.listInstallations.queryOptions({ provider })
    );
  }

  // Prefetch workspace sources
  prefetch(
    orgTrpc.workspace.sources.list.queryOptions({
      clerkOrgSlug: slug,
      workspaceName,
    })
  );

  return (
    <HydrateClient>
      <div className="pb-6">
        <div className="mb-6">
          <h1 className="font-semibold text-2xl tracking-tight">Add Sources</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Select sources to connect to this workspace
          </p>
        </div>
        <SourceSelectionProvider>
          <Suspense fallback={<SourcesSectionLoading />}>
            <SourcesSection />
          </Suspense>
          <Suspense>
            <LinkSourcesButton
              clerkOrgSlug={slug}
              workspaceName={workspaceName}
            />
          </Suspense>
        </SourceSelectionProvider>
      </div>
    </HydrateClient>
  );
}
