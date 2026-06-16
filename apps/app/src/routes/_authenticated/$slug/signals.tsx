import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { WorkspaceRouteErrorPanel } from "~/components/route-boundaries";
import { SignalsClient } from "~/signals/signals-client";
import { SignalsLoading } from "~/signals/signals-loading";
import {
  type NormalizedSignalsSearch,
  normalizeSignalsSearch,
  validateSignalsSearch,
} from "~/signals/signals-search-params";
import {
  loadRoutePrefetch,
  RoutePrefetchBoundary,
} from "~/trpc/route-prefetch";

export const Route = createFileRoute("/_authenticated/$slug/signals")({
  validateSearch: validateSignalsSearch,
  loader: () => loadRoutePrefetch({ data: { route: "signals" } }),
  head: ({ params }) => ({
    meta: [{ title: `Signals - ${params.slug} - Lightfast` }],
  }),
  pendingMs: 0,
  pendingMinMs: 0,
  pendingComponent: SignalsRoutePending,
  errorComponent: SignalsRouteError,
  component: SignalsPage,
});

function SignalsRoutePending() {
  return <SignalsLoading />;
}

function SignalsRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <WorkspaceRouteErrorPanel
      description="We couldn't load signals for this workspace. Refresh the route to try again."
      error={error}
      reset={reset}
      route="signals"
      title="Couldn't load signals"
    />
  );
}

function SignalsPage() {
  const prefetchState = Route.useLoaderData();
  const routeSearch = Route.useSearch();
  const search = useMemo(
    () => normalizeSignalsSearch(routeSearch),
    [routeSearch]
  );
  const navigate = Route.useNavigate();
  const setSearchParams = useCallback(
    (updates: Partial<NormalizedSignalsSearch>) => {
      void navigate({
        replace: true,
        search: (previous) => {
          const next = { ...previous };
          if ("disposition" in updates) {
            next.disposition = updates.disposition || undefined;
          }
          if ("kind" in updates) {
            next.kind = updates.kind || undefined;
          }
          if ("people" in updates) {
            next.people =
              updates.people === "routed" ? updates.people : undefined;
          }
          if ("priority" in updates) {
            next.priority = updates.priority || undefined;
          }
          if ("signal" in updates) {
            next.signal = updates.signal || undefined;
          }
          if ("view" in updates) {
            next.view = updates.view || undefined;
          }
          return next;
        },
      });
    },
    [navigate]
  );

  return (
    <RoutePrefetchBoundary state={prefetchState}>
      <SignalsClient search={search} setSearchParams={setSearchParams} />
    </RoutePrefetchBoundary>
  );
}
