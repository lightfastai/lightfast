import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { PeopleClient } from "~/people/people-client";
import {
  type NormalizedPeopleSearch,
  normalizePeopleSearch,
  validatePeopleSearch,
} from "~/people/people-search-params";

export const Route = createFileRoute("/_authenticated/$slug/people")({
  validateSearch: validatePeopleSearch,
  head: ({ params }) => ({
    meta: [{ title: `People - ${params.slug} - Lightfast` }],
  }),
  component: PeoplePage,
});

function PeoplePage() {
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
    <PeopleClient
      search={search}
      setSearchParams={setSearchParams}
      slug={slug}
    />
  );
}
