import type { Session } from "../types";

export function splitSessionsByPinned(sessions: Session[]) {
  return {
    pinnedSessions: sessions.filter(s => s.pinned),
    unpinnedSessions: sessions.filter(s => !s.pinned),
  };
}

export function flattenPages<T>(pages: T[][] | undefined): T[] {
  return pages?.flat() ?? [];
}