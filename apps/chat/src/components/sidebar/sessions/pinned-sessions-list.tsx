"use client";

import { useCallback } from "react";
import { usePinnedSessions } from "~/hooks/use-pinned-sessions";
import { usePinSession } from "~/hooks/use-pin-session";
import { PinnedSessions } from "./pinned-sessions";

interface PinnedSessionsListProps {
  className?: string;
}

export function PinnedSessionsList({ className }: PinnedSessionsListProps) {
  // Fetch pinned sessions with suspense
  const { data: pinnedSessions } = usePinnedSessions();
  
  // Mutations
  const setPinnedMutation = usePinSession();

  // Handlers
  const handlePinToggle = useCallback((sessionId: string) => {
    const session = pinnedSessions.find(s => s.id === sessionId);
    if (!session) return;
    
    setPinnedMutation.mutate({
      sessionId,
      pinned: !session.pinned,
    });
  }, [pinnedSessions, setPinnedMutation]);

  // Don't render anything if no pinned sessions
  if (pinnedSessions.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <PinnedSessions 
        sessions={pinnedSessions} 
        onPinToggle={handlePinToggle} 
      />
    </div>
  );
}