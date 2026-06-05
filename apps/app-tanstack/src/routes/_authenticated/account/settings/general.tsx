import { createFileRoute } from "@tanstack/react-router";
import { ProfileDataDisplay } from "~/account/settings/profile-data-display";

export const Route = createFileRoute("/_authenticated/account/settings/general")(
  {
    head: () => ({
      meta: [
        { title: "General Account Settings - Lightfast" },
        {
          name: "description",
          content: "Manage your Lightfast profile settings.",
        },
      ],
    }),
    component: ProfileDataDisplay,
  }
);
