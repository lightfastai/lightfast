import { createFileRoute } from "@tanstack/react-router";
import {
  WorkspaceRouteErrorPanel,
  WorkspaceRoutePending,
} from "~/components/route-boundaries";
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
  pendingComponent: BillingRoutePending,
  errorComponent: BillingRouteError,
  component: BillingSettingsPage,
});

function BillingRoutePending() {
  return <WorkspaceRoutePending label="Loading billing" />;
}

function BillingRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <WorkspaceRouteErrorPanel
      description="We couldn't load billing details for this organization. This is usually a temporary issue with the billing provider."
      error={error}
      reset={reset}
      route="org-billing-settings"
      title="Billing is temporarily unavailable"
    />
  );
}

function BillingSettingsPage() {
  const prefetchState = Route.useLoaderData();

  return (
    <RoutePrefetchBoundary state={prefetchState}>
      <BillingSettingsClient />
    </RoutePrefetchBoundary>
  );
}
