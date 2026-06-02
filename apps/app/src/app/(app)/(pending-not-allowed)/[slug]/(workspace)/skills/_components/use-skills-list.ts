"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { DEV_MOCK_LIST } from "./skills-dev-data";
import type { SkillsListResult } from "./skills-types";

// Shared accessor for the skills list. In development, when the org has no
// indexed skills yet, it falls back to DEV_MOCK_LIST so the page, dialog, and
// the @actions topbar slot all render populated. In production the dev branch
// is eliminated and the real query result is always returned.
export function useSkillsList(): SkillsListResult {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.org.workspace.skills.list.queryOptions(undefined, { staleTime: 0 })
  );

  if (data.skills.length === 0 && process.env.NODE_ENV === "development") {
    return DEV_MOCK_LIST;
  }

  return data;
}
