"use client";

import { parseAsString, useQueryState } from "nuqs";

/**
 * Search params hook for team creation page
 *
 * Manages URL query parameters for pre-filling the form:
 * - teamName: Team name to pre-fill (persists across refreshes)
 */
export function useTeamSearchParams() {
  const [teamName, setTeamName] = useQueryState(
    "teamName",
    parseAsString.withDefault("").withOptions({ shallow: true })
  );

  return {
    teamName,
    setTeamName,
  };
}
