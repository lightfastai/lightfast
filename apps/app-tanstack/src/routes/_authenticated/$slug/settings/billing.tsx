import { createFileRoute } from "@tanstack/react-router";
import { BillingSettingsClient } from "~/org/settings/billing/billing-settings-client";
import {
  loadRoutePrefetch,
  RoutePrefetchBoundary,
} from "~/trpc/route-prefetch";

export const Route = createFileRoute("/_authenticated/$slug/settings/billing")({
  loader: () => loadRoutePrefetch({ data: { route: "org.settings.billing" } }),
  head: ({ params }) => ({
    meta: [
      { title: `Billing - ${params.slug} - Lightfast` },
      {
        name: "description",
        content: "Manage your Lightfast workspace billing settings.",
      },
    ],
  }),
  component: BillingSettingsPage,
});

function BillingSettingsPage() {
  const prefetchState = Route.useLoaderData();

  return (
    <RoutePrefetchBoundary state={prefetchState}>
      <BillingSettingsClient />
    </RoutePrefetchBoundary>
  );
}
