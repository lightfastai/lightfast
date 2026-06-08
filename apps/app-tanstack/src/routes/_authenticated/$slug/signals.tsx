import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { SignalsClient } from "~/signals/signals-client";
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
  component: SignalsPage,
});

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
