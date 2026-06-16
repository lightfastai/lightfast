import { create } from "zustand";

interface SignalsUiState {
  collapsedListGroups: Record<string, boolean>;
  toggleListGroup: (groupId: string) => void;
}

export const useSignalsUiStore = create<SignalsUiState>((set) => ({
  collapsedListGroups: {},
  toggleListGroup: (groupId) =>
    set((state) => ({
      collapsedListGroups: {
        ...state.collapsedListGroups,
        [groupId]: !state.collapsedListGroups[groupId],
      },
    })),
}));
