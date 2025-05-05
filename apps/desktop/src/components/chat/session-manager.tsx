import { useEffect } from "react";
import { useActiveSessionId } from "@/hooks/use-active-session-id";
import { trpc } from "@/trpc";
import { useMutation, useQuery } from "@tanstack/react-query";

import { RouterOutputs } from "@vendor/trpc";

interface SessionManagerProps {
  workspaceId: string;
  children: (props: {
    activeSessionId: string | null;
    activeSession: RouterOutputs["tenant"]["session"]["get"] | null;
    refetchActiveSession: () => void;
  }) => React.ReactNode;
}

export function SessionManager({ workspaceId, children }: SessionManagerProps) {
  // Session management
  const [activeSessionId, setActiveSessionId] = useActiveSessionId();

  // Get all sessions for this workspace
  const { data: sessions = [], refetch: refetchSessions } = useQuery(
    trpc.tenant.session.list.queryOptions({
      workspaceId,
    }),
  );

  // Get the active session data (messages)
  const { data: activeSession, refetch: refetchActiveSession } = useQuery(
    trpc.tenant.session.get.queryOptions({
      sessionId: (activeSessionId as string) ?? "",
    }),
  );

  // Create session mutation
  const createSession = useMutation(
    trpc.tenant.session.create.mutationOptions({
      onSuccess: (data) => {
        if (data) {
          refetchSessions();
          setActiveSessionId(data.id);
        }
      },
    }),
  );

  // Set the first session as active if none is selected and sessions exist
  useEffect(() => {
    if (!activeSessionId && sessions.length > 0) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId, setActiveSessionId]);

  return (
    <>
      {children({
        activeSessionId,
        activeSession: activeSession ?? null,
        refetchActiveSession,
      })}
    </>
  );
}
