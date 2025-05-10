import { create } from "zustand";

import { SessionMode } from "../types/internal";

interface SessionState {
  sessionMode: SessionMode;
  setSessionMode: (mode: SessionMode) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessionMode: "manual", // Default to manual mode
  setSessionMode: (mode) => set({ sessionMode: mode }),
}));
