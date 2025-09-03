import type { RouterOutputs } from "@api/chat";

// Core session type from API
export type Session = RouterOutputs["session"]["list"][number];

// Props types
export interface SidebarProps {
  className?: string;
}

export interface SessionGroupProps {
  categoryName: string;
  sessions: Session[];
  onPinToggle: (sessionId: string) => void;
}

export interface SessionItemProps {
  session: Session;
  onPinToggle: (sessionId: string) => void;
}

// Constants
export const ITEMS_PER_PAGE = 20;