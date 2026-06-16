import { createFileRoute } from "@tanstack/react-router";
import { CreateTeamClient } from "~/account/team-create-client";

export const Route = createFileRoute("/_authenticated/account/teams/new")({
  head: () => ({
    meta: [
      { title: "Create Team - Lightfast" },
      {
        name: "description",
        content: "Create a Lightfast team workspace.",
      },
    ],
  }),
  component: CreateTeamPage,
});

function CreateTeamPage() {
  return <CreateTeamClient />;
}
