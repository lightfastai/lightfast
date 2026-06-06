import { createFileRoute } from "@tanstack/react-router";
import { BillingSettingsClient } from "~/org/settings/billing/billing-settings-client";

export const Route = createFileRoute("/_authenticated/$slug/settings/billing")({
  head: ({ params }) => ({
    meta: [
      { title: `Billing - ${params.slug} - Lightfast` },
      {
        name: "description",
        content: "Manage your Lightfast workspace billing settings.",
      },
    ],
  }),
  component: BillingSettingsClient,
});
