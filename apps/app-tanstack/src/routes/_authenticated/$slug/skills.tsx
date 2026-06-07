import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { SkillsClient } from "~/skills/skills-client";
import {
  type NormalizedSkillsSearch,
  normalizeSkillsSearch,
  validateSkillsSearch,
} from "~/skills/skills-search-params";
import {
  loadRoutePrefetch,
  RoutePrefetchBoundary,
} from "~/trpc/route-prefetch";

export const Route = createFileRoute("/_authenticated/$slug/skills")({
  validateSearch: validateSkillsSearch,
  loader: () => loadRoutePrefetch({ data: { route: "skills" } }),
  head: ({ params }) => ({
    meta: [{ title: `Skills - ${params.slug} - Lightfast` }],
  }),
  component: SkillsPage,
});

function SkillsPage() {
  const prefetchState = Route.useLoaderData();
  const routeSearch = Route.useSearch();
  const search = useMemo(
    () => normalizeSkillsSearch(routeSearch),
    [routeSearch]
  );
  const navigate = Route.useNavigate();
  const setSearchParams = useCallback(
    (updates: Partial<NormalizedSkillsSearch>) => {
      void navigate({
        replace: true,
        search: (previous) => {
          const next = { ...previous };
          if ("skill" in updates) {
            next.skill = updates.skill ?? undefined;
          }
          return next;
        },
      });
    },
    [navigate]
  );

  return (
    <RoutePrefetchBoundary state={prefetchState}>
      <SkillsClient search={search} setSearchParams={setSearchParams} />
    </RoutePrefetchBoundary>
  );
}
