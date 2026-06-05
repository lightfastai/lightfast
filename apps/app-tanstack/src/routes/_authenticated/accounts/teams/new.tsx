import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/accounts/teams/new")({
  beforeLoad: () => {
    throw redirect({ to: "/account/teams/new" });
  },
});
