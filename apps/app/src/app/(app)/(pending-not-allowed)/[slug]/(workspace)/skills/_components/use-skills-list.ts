"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import type { SkillsListResult } from "./skills-types";

// Shared accessor for the skills list, read by the page, dialog, and the
// @actions topbar slot so they all render from a single query result.
export function useSkillsList(): SkillsListResult {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.org.workspace.skills.list.queryOptions(undefined, { staleTime: 0 })
  );

  return data;
}
