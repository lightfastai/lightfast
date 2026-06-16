import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { WorkspaceRouteErrorPanel } from "~/components/route-boundaries";
import { PeopleClient } from "~/people/people-client";
import { PeopleLoading } from "~/people/people-loading";
import {
  type NormalizedPeopleSearch,
  normalizePeopleSearch,
  validatePeopleSearch,
} from "~/people/people-search-params";
import {
  loadRoutePrefetch,
  RoutePrefetchBoundary,
} from "~/trpc/route-prefetch";

export const Route = createFileRoute("/_authenticated/$slug/people")({
  validateSearch: validatePeopleSearch,
  loaderDeps: ({ search }) => ({
    peopleQuery: search.peopleQuery,
    provider: search.provider,
    type: search.type,
  }),
  loader: ({ deps }) =>
    loadRoutePrefetch({ data: { route: "people", ...deps } }),
  head: ({ params }) => ({
    meta: [{ title: `People - ${params.slug} - Lightfast` }],
  }),
  pendingMs: 250,
  pendingMinMs: 250,
  pendingComponent: PeopleRoutePending,
  errorComponent: PeopleRouteError,
  component: PeoplePage,
});

function PeopleRoutePending() {
  return <PeopleLoading />;
}

function PeopleRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <WorkspaceRouteErrorPanel
      description="We couldn't load people for this workspace. Refresh the route to try again."
      error={error}
      reset={reset}
      route="people"
      title="Couldn't load people"
    />
  );
}

function PeoplePage() {
  const prefetchState = Route.useLoaderData();
  const { slug } = Route.useParams();
  const routeSearch = Route.useSearch();
  const search = useMemo(
    () => normalizePeopleSearch(routeSearch),
    [routeSearch]
  );
  const navigate = Route.useNavigate();
  const setSearchParams = useCallback(
    (updates: Partial<NormalizedPeopleSearch>) => {
      void navigate({
        replace: true,
        search: (previous) => {
          const next = { ...previous };
          if ("peopleQuery" in updates) {
            next.peopleQuery = updates.peopleQuery || undefined;
          }
          if ("provider" in updates) {
            next.provider = updates.provider || undefined;
          }
          if ("type" in updates) {
            next.type = updates.type || undefined;
          }
          if ("person" in updates) {
            next.person = updates.person || undefined;
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
      <PeopleClient
        search={search}
        setSearchParams={setSearchParams}
        slug={slug}
      />
    </RoutePrefetchBoundary>
  );
}
