"use client";

import { parseAsString, useQueryState } from "nuqs";

/**
 * Search params hook for workspace creation page
 *
 * Manages URL query parameters for pre-filling the form:
 * - teamSlug: Organization slug to pre-select
 * - workspaceName: Workspace name to pre-fill (persists across refreshes)
 */
export function useWorkspaceSearchParams() {
  const [teamSlug, setTeamSlug] = useQueryState(
    "teamSlug",
    parseAsString.withDefault("").withOptions({ shallow: true })
  );

  const [workspaceName, setWorkspaceName] = useQueryState(
    "workspaceName",
    parseAsString.withDefault("").withOptions({ shallow: true })
  );

  return {
    teamSlug,
    setTeamSlug,
    workspaceName,
    setWorkspaceName,
  };
}
