import { Suspense } from "react";
import { prefetch, HydrateClient, orgTrpc } from "@repo/console-trpc/server";
import { SourceSelectionProvider } from "./_components/source-selection-provider";
import { SourcesSection } from "./_components/sources-section";
import { SourcesSectionLoading } from "./_components/sources-section-loading";
import { LinkSourcesButton } from "./_components/link-sources-button";

export default async function AddSourcesPage({
	params,
}: {
	params: Promise<{ slug: string; workspaceName: string }>;
}) {
	const { slug, workspaceName } = await params;

	// Prefetch connection status for all 4 providers
	prefetch(orgTrpc.connections.github.list.queryOptions());
	prefetch(orgTrpc.connections.vercel.list.queryOptions());
	prefetch(orgTrpc.connections.linear.get.queryOptions());
	prefetch(orgTrpc.connections.sentry.get.queryOptions());

	// Prefetch workspace sources (gives us workspaceId + existing sources)
	prefetch(
		orgTrpc.workspace.sources.list.queryOptions({
			clerkOrgSlug: slug,
			workspaceName,
		}),
	);

	return (
		<HydrateClient>
			<div className="pb-6">
				<div className="mb-6">
					<h1 className="text-2xl font-semibold tracking-tight">
						Add Sources
					</h1>
					<p className="text-sm text-muted-foreground mt-1">
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
