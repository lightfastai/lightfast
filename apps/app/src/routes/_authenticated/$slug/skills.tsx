import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { SkillsClient } from "~/skills/skills-client";
import {
  type NormalizedSkillsSearch,
  normalizeSkillsSearch,
  validateSkillsSearch,
} from "~/skills/skills-search-params";

export const Route = createFileRoute("/_authenticated/$slug/skills")({
  validateSearch: validateSkillsSearch,
  head: ({ params }) => ({
    meta: [{ title: `Skills - ${params.slug} - Lightfast` }],
  }),
  component: SkillsPage,
});

function SkillsPage() {
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

  return <SkillsClient search={search} setSearchParams={setSearchParams} />;
}
