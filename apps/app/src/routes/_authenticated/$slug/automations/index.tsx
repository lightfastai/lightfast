import { createFileRoute } from "@tanstack/react-router";
import { AutomationsClient } from "~/automations/automations-client";
import {
  WorkspaceRouteErrorPanel,
  WorkspaceRoutePending,
} from "~/components/route-boundaries";
import {
  loadRoutePrefetch,
  RoutePrefetchBoundary,
} from "~/trpc/route-prefetch";

export const Route = createFileRoute("/_authenticated/$slug/automations/")({
  loader: () => loadRoutePrefetch({ data: { route: "automations.list" } }),
  head: ({ params }) => ({
    meta: [{ title: `Automations - ${params.slug} - Lightfast` }],
  }),
  pendingMs: 0,
  pendingMinMs: 0,
  pendingComponent: AutomationsRoutePending,
  errorComponent: AutomationsRouteError,
  component: AutomationsPage,
});

function AutomationsRoutePending() {
  return (
    <WorkspaceRoutePending className="min-h-full" label="Loading automations" />
  );
}

function AutomationsRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <WorkspaceRouteErrorPanel
      description="We couldn't load automations for this workspace. Refresh the route to try again."
      error={error}
      reset={reset}
      route="automations"
      title="Couldn't load automations"
    />
  );
}

function AutomationsPage() {
  const { slug } = Route.useParams();
  const prefetchState = Route.useLoaderData();

  return (
    <RoutePrefetchBoundary state={prefetchState}>
      <AutomationsClient slug={slug} />
    </RoutePrefetchBoundary>
  );
}
