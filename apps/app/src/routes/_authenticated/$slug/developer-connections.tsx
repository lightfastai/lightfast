import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { DeveloperConnectionsClient } from "~/developer-connections/developer-connections-client";
import {
  type NormalizedDeveloperConnectionsSearch,
  normalizeDeveloperConnectionsSearch,
  validateDeveloperConnectionsSearch,
} from "~/developer-connections/developer-connections-search-params";

export const Route = createFileRoute(
  "/_authenticated/$slug/developer-connections"
)({
  validateSearch: validateDeveloperConnectionsSearch,
  head: ({ params }) => ({
    meta: [{ title: `Developer Connections - ${params.slug} - Lightfast` }],
  }),
  component: DeveloperConnectionsPage,
});

function DeveloperConnectionsPage() {
  const routeSearch = Route.useSearch();
  const search = useMemo(
    () => normalizeDeveloperConnectionsSearch(routeSearch),
    [routeSearch]
  );
  const navigate = Route.useNavigate();
  const setSearchParams = useCallback(
    (updates: Partial<NormalizedDeveloperConnectionsSearch>) => {
      void navigate({
        replace: true,
        search: (previous) => {
          const next = { ...previous };
          if ("connection" in updates) {
            next.connection = updates.connection || undefined;
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
    <DeveloperConnectionsClient
      search={search}
      setSearchParams={setSearchParams}
    />
  );
}
