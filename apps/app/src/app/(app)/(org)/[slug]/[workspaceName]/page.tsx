import { HydrateClient, orgTrpc, prefetch } from "@repo/app-trpc/server";
import { Suspense } from "react";
import { AskLightfast, AskLightfastSkeleton } from "~/components/ask-lightfast";

export default async function AskLightfastPage({
  params,
}: {
  params: Promise<{ slug: string; workspaceName: string }>;
}) {
  const { slug, workspaceName } = await params;

  // Prefetch workspace's single store (1:1 relationship)
  prefetch(
    orgTrpc.workspace.store.get.queryOptions({
      clerkOrgSlug: slug,
      workspaceName,
    })
  );

  return (
    <Suspense fallback={<AskLightfastSkeleton />}>
      <HydrateClient>
        <AskLightfast orgSlug={slug} workspaceName={workspaceName} />
      </HydrateClient>
    </Suspense>
  );
}
