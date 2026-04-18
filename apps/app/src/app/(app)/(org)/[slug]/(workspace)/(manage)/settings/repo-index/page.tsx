import { HydrateClient, prefetch, trpc } from "@repo/app-trpc/server";
import { Suspense } from "react";
import { RepoIndexConfig } from "./_components/repo-index-config";
import { RepoIndexConfigLoading } from "./_components/repo-index-config-loading";

export const dynamic = "force-dynamic";

export default function RepoIndexPage() {
  prefetch(trpc.repoIndex.status.queryOptions());

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-medium font-pp text-2xl text-foreground">
          Repo Index
        </h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Connect your{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            .lightfast
          </code>{" "}
          repository to provide organizational context to AI agents.
        </p>
      </div>

      <HydrateClient>
        <Suspense fallback={<RepoIndexConfigLoading />}>
          <RepoIndexConfig />
        </Suspense>
      </HydrateClient>
    </div>
  );
}
