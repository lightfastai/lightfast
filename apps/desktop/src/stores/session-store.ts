import { SessionMode } from "@/types/internal";
import { create } from "zustand";

interface SessionState {
  sessionMode: SessionMode;
  readyToolCalls: Record<string, boolean>; // Track which tool calls are ready for execution
  setSessionMode: (mode: SessionMode) => void;
  markToolCallReady: (toolCallId: string) => void; // Mark a tool call as ready
}

export const useSessionStore = create<SessionState>((set) => ({
  sessionMode: "manual", // Default to manual mode
  readyToolCalls: {},

  setSessionMode: (mode: SessionMode) => set({ sessionMode: mode }),

  markToolCallReady: (toolCallId: string) =>
    set((state) => ({
      readyToolCalls: {
        ...state.readyToolCalls,
        [toolCallId]: true,
      },
    })),
}));
