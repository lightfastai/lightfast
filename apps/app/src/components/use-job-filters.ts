"use client";

import { parseAsString, useQueryState } from "nuqs";

/**
 * Job filters hook for jobs page
 *
 * Manages URL query parameters for filtering jobs:
 * - status: Filter by job status (all, running, completed, failed)
 * - search: Search query for filtering jobs by name
 *
 * Takes initial values from server-side searchParams for SSR optimization
 */
export function useJobFilters(initialStatus = "all", initialSearch = "") {
  const [status, setStatus] = useQueryState(
    "status",
    parseAsString.withDefault(initialStatus).withOptions({ shallow: true })
  );

  const [search, setSearch] = useQueryState(
    "search",
    parseAsString.withDefault(initialSearch).withOptions({ shallow: true })
  );

  return {
    status,
    setStatus,
    search,
    setSearch,
  };
}
