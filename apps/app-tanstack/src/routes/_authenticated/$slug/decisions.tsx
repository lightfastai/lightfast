import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { DecisionsClient } from "~/decisions/decisions-client";
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
  loader: () => loadRoutePrefetch({ data: { route: "decisions" } }),
  head: ({ params }) => ({
    meta: [{ title: `Decisions - ${params.slug} - Lightfast` }],
  }),
  component: DecisionsPage,
});

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
