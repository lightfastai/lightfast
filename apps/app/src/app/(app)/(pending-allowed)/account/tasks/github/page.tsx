import { githubUserAccountBindErrorCodeSchema } from "@repo/github-app-contract";
import { Suspense } from "react";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";
import { GithubAccountTaskClient } from "./_components/github-account-task-client";

export const dynamic = "force-dynamic";

interface GitHubAccountTaskPageProps {
  searchParams: Promise<{ github_error?: string | string[] }>;
}

export default async function GitHubAccountTaskPage({
  searchParams,
}: GitHubAccountTaskPageProps) {
  const { github_error: githubErrorParam } = await searchParams;
  const parsedError = githubUserAccountBindErrorCodeSchema.safeParse(
    Array.isArray(githubErrorParam) ? githubErrorParam[0] : githubErrorParam
  );

  prefetch(trpc.viewer.githubAccount.status.queryOptions());

  return (
    <HydrateClient>
      <Suspense fallback={null}>
        <GithubAccountTaskClient
          githubError={parsedError.success ? parsedError.data : undefined}
        />
      </Suspense>
    </HydrateClient>
  );
}
