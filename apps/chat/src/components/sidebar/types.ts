import type { RouterOutputs } from "@vendor/trpc";

// Core session type from API
export type Session = RouterOutputs["chat"]["session"]["list"][number];

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
export const ITEMS_PER_PAGE = 5;