import { githubUserAccountBindErrorCodeSchema } from "@repo/github-app-contract";
import { createFileRoute } from "@tanstack/react-router";
import { GithubAccountTaskClient } from "~/account/tasks/github-account-task-client";
import {
  loadRoutePrefetch,
  RoutePrefetchBoundary,
} from "~/trpc/route-prefetch";

export const Route = createFileRoute("/_authenticated/account/tasks/github/")({
  loader: () => loadRoutePrefetch({ data: { route: "account.githubTask" } }),
  head: () => ({
    meta: [
      { title: "Connect GitHub Account - Lightfast" },
      {
        name: "description",
        content: "Connect your GitHub account to Lightfast.",
      },
    ],
  }),
  validateSearch: (search) => {
    const parsedError = githubUserAccountBindErrorCodeSchema.safeParse(
      search.github_error
    );
    return {
      github_error: parsedError.success ? parsedError.data : undefined,
    };
  },
  component: GithubAccountTaskPage,
});

function GithubAccountTaskPage() {
  const prefetchState = Route.useLoaderData();
  const search = Route.useSearch();
  return (
    <RoutePrefetchBoundary state={prefetchState}>
      <GithubAccountTaskClient githubError={search.github_error} />
    </RoutePrefetchBoundary>
  );
}
