"use client";

import { providerSlugSchema } from "@repo/app-providers/client";
import { parseAsString, parseAsStringEnum, useQueryStates } from "nuqs";
import { AGE_PRESET_OPTIONS } from "~/components/search-constants";

const SOURCE_OPTIONS = ["all", ...providerSlugSchema.options] as const;
const AGE_OPTIONS = AGE_PRESET_OPTIONS.map((o) => o.value);

export type EventSource = (typeof SOURCE_OPTIONS)[number];
export type EventAge = (typeof AGE_PRESET_OPTIONS)[number]["value"];

export function useEventFilters(initialSource?: string) {
  const [filters, setFilters] = useQueryStates(
    {
      source: parseAsStringEnum<EventSource>([...SOURCE_OPTIONS]).withDefault(
        (initialSource ?? "all") as EventSource
      ),
      search: parseAsString.withDefault(""),
      age: parseAsStringEnum<EventAge>([...AGE_OPTIONS]).withDefault("none"),
    },
    { history: "replace", shallow: true }
  );

  return { filters, setFilters };
}
