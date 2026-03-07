"use client";

import { parseAsString, parseAsStringEnum, useQueryStates } from "nuqs";
import { AGE_PRESET_OPTIONS } from "~/components/search-constants";
import { PROVIDER_SLUGS } from "@repo/console-providers/display";

const SOURCE_OPTIONS = ["all", ...PROVIDER_SLUGS] as const;
const AGE_OPTIONS = AGE_PRESET_OPTIONS.map((o) => o.value);

export type EventSource = (typeof SOURCE_OPTIONS)[number];
export type EventAge = (typeof AGE_PRESET_OPTIONS)[number]["value"];

export function useEventFilters(initialSource?: string) {
  const [filters, setFilters] = useQueryStates(
    {
      source: parseAsStringEnum<EventSource>([...SOURCE_OPTIONS]).withDefault(
        (initialSource ?? "all") as EventSource,
      ),
      search: parseAsString.withDefault(""),
      age: parseAsStringEnum<EventAge>([...AGE_OPTIONS]).withDefault("none"),
    },
    { history: "replace", shallow: true },
  );

  return { filters, setFilters };
}
