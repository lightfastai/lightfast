import { createFileRoute } from "@tanstack/react-router";
import { UsernameAccountTaskClient } from "~/account/tasks/username-account-task-client";

export const Route = createFileRoute("/_authenticated/account/tasks/username")({
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
  const search = Route.useSearch();
  return <UsernameAccountTaskClient returnTo={search.return_to} />;
}
