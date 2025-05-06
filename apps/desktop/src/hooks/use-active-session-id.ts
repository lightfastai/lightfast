import { useEffect } from "react";
import { useActiveSessionStore } from "@/store/active-session-store";
import { trpc } from "@/trpc";
import { useQuery } from "@tanstack/react-query";

import { useCurrentWorkspaceId } from "./use-current-workspace-id";

/**
 * Custom hook to get the current active session ID and a setter function
 *
 * @returns [activeSessionId, setActiveSessionId]
 */
export function useActiveSessionId(): [string | null, (id: string) => void] {
  const currentWorkspaceId = useCurrentWorkspaceId();
  const { activeSessionId, setActiveSessionId } = useActiveSessionStore();

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
  }, [sessions, activeSessionId, setActiveSessionId]);

  // Listen for session selection events
  useEffect(() => {
    const handleSessionSelected = (event: any) => {
      if (event.detail && event.detail.sessionId) {
        setActiveSessionId(event.detail.sessionId);
      }
    };

    window.addEventListener("session-selected", handleSessionSelected);

    return () => {
      window.removeEventListener("session-selected", handleSessionSelected);
    };
  }, [setActiveSessionId]);

  return [activeSessionId, setActiveSessionId];
}
