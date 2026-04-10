"use client";

import { entityCategorySchema } from "@repo/app-validation";
import { parseAsString, parseAsStringEnum, useQueryStates } from "nuqs";

const CATEGORY_OPTIONS = ["all", ...entityCategorySchema.options] as const;
export type EntityCategoryFilter = (typeof CATEGORY_OPTIONS)[number];

export function useEntityFilters() {
  const [filters, setFilters] = useQueryStates(
    {
      category: parseAsStringEnum<EntityCategoryFilter>([
        ...CATEGORY_OPTIONS,
      ]).withDefault("all"),
      search: parseAsString.withDefault(""),
    },
    { history: "replace", shallow: true }
  );

  return { filters, setFilters };
}
