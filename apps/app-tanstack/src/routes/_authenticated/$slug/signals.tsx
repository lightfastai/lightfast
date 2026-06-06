import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { SignalsClient } from "~/signals/signals-client";
import {
  normalizeSignalsSearch,
  type SignalsSearchKey,
  validateSignalsSearch,
} from "~/signals/signals-search-params";

const SIGNAL_FILTER_SEARCH_KEYS = new Set<SignalsSearchKey>([
  "disposition",
  "kind",
  "people",
  "priority",
]);

export const Route = createFileRoute("/_authenticated/$slug/signals")({
  validateSearch: validateSignalsSearch,
  head: ({ params }) => ({
    meta: [{ title: `Signals - ${params.slug} - Lightfast` }],
  }),
  component: SignalsPage,
});

function SignalsPage() {
  const routeSearch = Route.useSearch();
  const search = useMemo(
    () => normalizeSignalsSearch(routeSearch),
    [routeSearch]
  );
  const navigate = Route.useNavigate();
  const setSearchParam = useCallback(
    (key: SignalsSearchKey, value: string | null) => {
      void navigate({
        replace: true,
        search: (previous) => {
          const next = { ...previous };
          if (SIGNAL_FILTER_SEARCH_KEYS.has(key)) {
            next.view = undefined;
          }
          switch (key) {
            case "disposition":
              if (value) {
                next.disposition = value;
              } else {
                next.disposition = undefined;
              }
              break;
            case "kind":
              if (value) {
                next.kind = value;
              } else {
                next.kind = undefined;
              }
              break;
            case "people":
              if (value === "routed") {
                next.people = "routed";
              } else {
                next.people = undefined;
              }
              break;
            case "priority":
              if (value) {
                next.priority = value;
              } else {
                next.priority = undefined;
              }
              break;
            case "signal":
              if (value) {
                next.signal = value;
              } else {
                next.signal = undefined;
              }
              break;
            case "view":
              if (value) {
                next.view = value;
              } else {
                next.view = undefined;
              }
              break;
            default:
              break;
          }
          return next;
        },
      });
    },
    [navigate]
  );

  return <SignalsClient search={search} setSearchParam={setSearchParam} />;
}
