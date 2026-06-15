import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/account")({
  beforeLoad: ({ location }) => {
    if (location.pathname === "/account") {
      throw redirect({ to: "/account/settings/general" });
    }
  },
  component: Outlet,
});
