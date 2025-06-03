import { create } from "zustand";

import { env } from "~/env";

// Define ScrollState here as the canonical source
export type ScrollState = "initial" | "earlyAccess";

interface BinaryScrollStoreActions {
  // This will be called by the hook's internal logic to update the store's state
  _setCurrentStateFromHook: (newState: ScrollState) => void;
  // This is what components will call to initiate a manual state change
  manualChangeState: (newState: ScrollState) => void;
}

interface BinaryScrollStoreState {
  currentState: ScrollState;
}

// This will hold the function from the main hook that can actually execute a manual change
let _executeManualChange: (newState: ScrollState) => void = () => {
  if (env.NODE_ENV === "development") {
    console.warn(
      "BinaryScrollStore: _executeManualChange not yet registered or called before registration.",
    );
  }
};

export const useBinaryScrollStore = create<
  BinaryScrollStoreState & BinaryScrollStoreActions
>((set) => ({
  currentState: "initial",
  _setCurrentStateFromHook: (newState) => {
    set({ currentState: newState });
  },
  manualChangeState: (newState) => {
    // This will call the complex logic within the adapted useBinaryScrollState hook
    _executeManualChange(newState);
  },
}));

// This function is called once by the main setup hook (adapted from useBinaryScrollState)
// to provide the core scroll logic engine with the ability to execute a manual state change.
export const registerCoreScrollLogic = (
  executeManualChangeFn: (newState: ScrollState) => void,
) => {
  _executeManualChange = executeManualChangeFn;
};
