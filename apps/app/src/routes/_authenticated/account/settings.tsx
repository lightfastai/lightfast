import { createFileRoute, redirect } from "@tanstack/react-router";
import { AccountSettingsLayout } from "~/account/settings/account-settings-layout";

export const Route = createFileRoute("/_authenticated/account/settings")({
  beforeLoad: ({ location }) => {
    if (location.pathname === "/account/settings") {
      throw redirect({
        search: location.search,
        to: "/account/settings/general",
      });
    }
  },
  head: () => ({
    meta: [
      { title: "Account Settings - Lightfast" },
      {
        name: "description",
        content: "Manage your Lightfast account settings.",
      },
    ],
  }),
  component: AccountSettingsLayout,
});
