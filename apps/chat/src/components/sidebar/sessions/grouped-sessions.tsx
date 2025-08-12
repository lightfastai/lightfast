import { useMemo } from "react";
import { SessionGroup } from "../components/session-group";
import { groupByDate, DATE_GROUP_ORDER } from "~/lib/date";
import type { Session } from "../types";

interface GroupedSessionsProps {
  sessions: Session[];
  onPinToggle: (sessionId: string) => void;
}

export function GroupedSessions({ sessions, onPinToggle }: GroupedSessionsProps) {
  const groupedSessions = useMemo(
    () => groupByDate(sessions),
    [sessions]
  );

  return (
    <>
      {DATE_GROUP_ORDER.map((category) => {
        const categorySessions = groupedSessions[category];
        if (categorySessions.length > 0) {
          return (
            <SessionGroup
              key={category}
              categoryName={category}
              sessions={categorySessions}
              onPinToggle={onPinToggle}
            />
          );
        }
        return null;
      })}
    </>
  );
}