import { createFileRoute } from "@tanstack/react-router";
import { AccountSourceControlClient } from "~/account/settings/account-source-control-client";

export const Route = createFileRoute(
  "/_authenticated/account/settings/source-control"
)({
  head: () => ({
    meta: [
      { title: "Source Control Account Settings - Lightfast" },
      {
        name: "description",
        content: "Connect your GitHub account to Lightfast.",
      },
    ],
  }),
  component: AccountSourceControlSettingsPage,
});

function AccountSourceControlSettingsPage() {
  return <AccountSourceControlClient />;
}
