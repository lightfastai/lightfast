import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { ConnectorsClient } from "~/connectors/connectors-client";
import {
  type NormalizedConnectorsSearch,
  normalizeConnectorsSearch,
  validateConnectorsSearch,
} from "~/connectors/connectors-search-params";

export const Route = createFileRoute("/_authenticated/$slug/connectors")({
  validateSearch: validateConnectorsSearch,
  head: ({ params }) => ({
    meta: [{ title: `Connectors - ${params.slug} - Lightfast` }],
  }),
  component: ConnectorsPage,
});

function ConnectorsPage() {
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
          if ("scope" in updates) {
            next.scope =
              updates.scope && updates.scope !== "team"
                ? updates.scope
                : undefined;
          }
          return next;
        },
      });
    },
    [navigate]
  );

  return <ConnectorsClient search={search} setSearchParams={setSearchParams} />;
}
