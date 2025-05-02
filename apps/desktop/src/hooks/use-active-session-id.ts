import { useEffect, useState } from "react";
import { trpc } from "@/trpc";
import { useQuery } from "@tanstack/react-query";

import { useCurrentWorkspaceId } from "./use-current-workspace-id";

/**
 * Custom hook to get the current active session ID
 *
 * @returns The active session ID or null if none is found
 */
export function useActiveSessionId(): string | null {
  const currentWorkspaceId = useCurrentWorkspaceId();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Get all sessions for the current workspace
  const { data: sessions = [] } = useQuery(
    trpc.tenant.session.list.queryOptions({
      workspaceId: currentWorkspaceId ?? "",
    }),
  );

  // Set the first session as active if none is selected and sessions exist
  useEffect(() => {
    if (!activeSessionId && sessions.length > 0) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  return activeSessionId;
}
