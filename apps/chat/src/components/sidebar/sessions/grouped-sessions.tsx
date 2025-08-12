import { useMemo } from "react";
import { SessionGroup } from "../components/session-group";
import { groupByDate, DATE_GROUP_ORDER } from "~/lib/date";
import type { DateGroup } from "~/lib/date";
import type { Session } from "../types";

interface GroupedSessionsProps {
  sessions: Session[];
  onPinToggle: (sessionId: string) => void;
}

export function GroupedSessions({ sessions, onPinToggle }: GroupedSessionsProps) {
  const groupedSessions = useMemo(() => {
    const sessionsWithDates = sessions.map(session => ({
      ...session,
      createdAt: new Date(session.createdAt)
    }));
    const grouped = groupByDate(sessionsWithDates);
    
    // Convert back to original Session type with string dates
    const result: Record<DateGroup, Session[]> = {} as Record<DateGroup, Session[]>;
    Object.entries(grouped).forEach(([category, sessionArray]) => {
      result[category as DateGroup] = sessionArray.map(session => ({
        ...session,
        createdAt: session.createdAt.toISOString()
      }));
    });
    return result;
  }, [sessions]);

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