import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { WorkspaceRouteErrorPanel } from "~/components/route-boundaries";
import { DecisionsClient } from "~/decisions/decisions-client";
import { DecisionsLoading } from "~/decisions/decisions-loading";
import {
  type NormalizedDecisionsSearch,
  normalizeDecisionsSearch,
  validateDecisionsSearch,
} from "~/decisions/decisions-search-params";
import {
  loadRoutePrefetch,
  RoutePrefetchBoundary,
} from "~/trpc/route-prefetch";

export const Route = createFileRoute("/_authenticated/$slug/decisions")({
  validateSearch: validateDecisionsSearch,
  loaderDeps: ({ search }) => ({
    provider: search.provider,
    q: search.q,
    status: search.status,
  }),
  loader: ({ deps }) =>
    loadRoutePrefetch({ data: { route: "decisions", ...deps } }),
  head: ({ params }) => ({
    meta: [{ title: `Decisions - ${params.slug} - Lightfast` }],
  }),
  pendingMs: 0,
  pendingMinMs: 0,
  pendingComponent: DecisionsRoutePending,
  errorComponent: DecisionsRouteError,
  component: DecisionsPage,
});

function DecisionsRoutePending() {
  return <DecisionsLoading />;
}

function DecisionsRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <WorkspaceRouteErrorPanel
      description="We couldn't load decisions for this workspace. Refresh the route to try again."
      error={error}
      reset={reset}
      route="decisions"
      title="Couldn't load decisions"
    />
  );
}

function DecisionsPage() {
  const prefetchState = Route.useLoaderData();
  const routeSearch = Route.useSearch();
  const search = useMemo(
    () => normalizeDecisionsSearch(routeSearch),
    [routeSearch]
  );
  const navigate = Route.useNavigate();
  const setSearchParams = useCallback(
    (updates: Partial<NormalizedDecisionsSearch>) => {
      void navigate({
        replace: true,
        search: (previous) => {
          const next = { ...previous };
          if ("decision" in updates) {
            next.decision = updates.decision || undefined;
          }
          if ("provider" in updates) {
            next.provider = updates.provider || undefined;
          }
          if ("q" in updates) {
            next.q = updates.q || undefined;
          }
          if ("status" in updates) {
            next.status = updates.status || undefined;
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
      <DecisionsClient search={search} setSearchParams={setSearchParams} />
    </RoutePrefetchBoundary>
  );
}
