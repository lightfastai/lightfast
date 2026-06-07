import { createFileRoute } from "@tanstack/react-router";
import { GithubAccountCompleteClient } from "~/account/tasks/github-account-complete-client";

export const Route = createFileRoute(
  "/_authenticated/account/tasks/github/complete"
)({
  head: () => ({
    meta: [
      { title: "Finishing GitHub Connection - Lightfast" },
      {
        name: "description",
        content: "Finish connecting your GitHub account to Lightfast.",
      },
    ],
  }),
  validateSearch: (search) => ({
    return_to:
      typeof search.return_to === "string" ? search.return_to : undefined,
  }),
  component: GithubAccountCompletePage,
});

function GithubAccountCompletePage() {
  const search = Route.useSearch();
  return <GithubAccountCompleteClient returnTo={search.return_to} />;
}
