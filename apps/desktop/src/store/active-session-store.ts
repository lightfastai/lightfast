import { create } from "zustand";

interface ActiveSessionState {
  activeSessionId: string | null;
  setActiveSessionId: (id: string) => void;
}

export const useActiveSessionStore = create<ActiveSessionState>((set) => ({
  activeSessionId: null,
  setActiveSessionId: (id: string) => set({ activeSessionId: id }),
}));
