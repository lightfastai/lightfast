import { createFileRoute } from "@tanstack/react-router";
import { UsernameAccountTaskClient } from "~/account/tasks/username-account-task-client";
import {
  loadRoutePrefetch,
  RoutePrefetchBoundary,
} from "~/trpc/route-prefetch";

export const Route = createFileRoute("/_authenticated/account/tasks/username")({
  loader: () => loadRoutePrefetch({ data: { route: "account.usernameTask" } }),
  head: () => ({
    meta: [
      { title: "Choose Username - Lightfast" },
      {
        name: "description",
        content: "Choose your Lightfast account username.",
      },
    ],
  }),
  validateSearch: (search) => ({
    return_to:
      typeof search.return_to === "string" ? search.return_to : undefined,
  }),
  component: UsernameAccountTaskPage,
});

function UsernameAccountTaskPage() {
  const prefetchState = Route.useLoaderData();
  const search = Route.useSearch();
  return (
    <RoutePrefetchBoundary state={prefetchState}>
      <UsernameAccountTaskClient returnTo={search.return_to} />
    </RoutePrefetchBoundary>
  );
}
