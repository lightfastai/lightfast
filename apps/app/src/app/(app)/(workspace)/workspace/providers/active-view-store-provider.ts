import { create } from "zustand";

import { ActiveView } from "../types/active-view";

interface ActiveViewState {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  clearActiveView: () => void;
}

export const useActiveViewStore = create<ActiveViewState>((set) => ({
  activeView: ActiveView.WORKSPACE,
  setActiveView: (view) => set({ activeView: view }),
  clearActiveView: () => set({ activeView: ActiveView.NONE }),
}));
