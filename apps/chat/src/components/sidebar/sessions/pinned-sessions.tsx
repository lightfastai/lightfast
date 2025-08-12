import { SessionGroup } from "../components/session-group";
import type { Session } from "../types";

interface PinnedSessionsProps {
  sessions: Session[];
  onPinToggle: (sessionId: string) => void;
}

export function PinnedSessions({ sessions, onPinToggle }: PinnedSessionsProps) {
  if (sessions.length === 0) return null;
  
  return (
    <SessionGroup
      categoryName="Pinned"
      sessions={sessions}
      onPinToggle={onPinToggle}
    />
  );
}