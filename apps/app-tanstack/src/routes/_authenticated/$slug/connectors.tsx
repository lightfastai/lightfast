import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { ConnectorsClient } from "~/connectors/connectors-client";
import {
  type NormalizedConnectorsSearch,
  normalizeConnectorsSearch,
  validateConnectorsSearch,
} from "~/connectors/connectors-search-params";
import {
  loadRoutePrefetch,
  RoutePrefetchBoundary,
} from "~/trpc/route-prefetch";

export const Route = createFileRoute("/_authenticated/$slug/connectors")({
  validateSearch: validateConnectorsSearch,
  loader: () => loadRoutePrefetch({ data: { route: "connectors" } }),
  head: ({ params }) => ({
    meta: [{ title: `Connectors - ${params.slug} - Lightfast` }],
  }),
  component: ConnectorsPage,
});

function ConnectorsPage() {
  const prefetchState = Route.useLoaderData();
  const routeSearch = Route.useSearch();
  const search = useMemo(
    () => normalizeConnectorsSearch(routeSearch),
    [routeSearch]
  );
  const navigate = Route.useNavigate();
  const setSearchParams = useCallback(
    (updates: Partial<NormalizedConnectorsSearch>) => {
      void navigate({
        replace: true,
        search: (previous) => {
          const next = { ...previous };
          if ("connector" in updates) {
            next.connector = updates.connector || undefined;
          }
          if ("error" in updates) {
            next.error = updates.error || undefined;
          }
          return next;
        },
      });
    },
    [navigate]
  );

  return (
    <RoutePrefetchBoundary state={prefetchState}>
      <ConnectorsClient search={search} setSearchParams={setSearchParams} />
    </RoutePrefetchBoundary>
  );
}
