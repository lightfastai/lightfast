import { githubUserAccountBindErrorCodeSchema } from "@lightfast/connector-github/contract";
import { createFileRoute } from "@tanstack/react-router";
import { GithubAccountTaskClient } from "~/account/tasks/github-account-task-client";

export const Route = createFileRoute("/_authenticated/account/tasks/github/")({
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
  const search = Route.useSearch();
  return <GithubAccountTaskClient githubError={search.github_error} />;
}
