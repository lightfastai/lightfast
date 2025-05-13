import { create } from "zustand";

export type ToolExecutionState = {
  pending: boolean;
  error: string | null;
  executed: boolean;
};

type ToolExecutionStore = {
  toolStates: Record<string, ToolExecutionState>;
  setToolPending: (toolCallId: string, pending: boolean) => void;
  setToolExecuted: (
    toolCallId: string,
    executed: boolean,
    error?: string | null,
  ) => void;
  getToolState: (toolCallId: string) => ToolExecutionState;
  resetToolState: (toolCallId: string) => void;
};

export const useToolExecutionStore = create<ToolExecutionStore>((set, get) => ({
  toolStates: {},

  setToolPending: (toolCallId: string, pending: boolean) =>
    set((state) => ({
      toolStates: {
        ...state.toolStates,
        [toolCallId]: {
          ...(state.toolStates[toolCallId] || { error: null, executed: false }),
          pending,
        },
      },
    })),

  setToolExecuted: (toolCallId: string, executed: boolean, error = null) =>
    set((state) => ({
      toolStates: {
        ...state.toolStates,
        [toolCallId]: {
          ...(state.toolStates[toolCallId] || { pending: false }),
          executed,
          error,
          pending: false, // Always reset pending when setting executed
        },
      },
    })),

  getToolState: (toolCallId: string) => {
    const state = get().toolStates[toolCallId];
    return state || { pending: false, error: null, executed: false };
  },

  resetToolState: (toolCallId: string) =>
    set((state) => {
      const newToolStates = { ...state.toolStates };
      delete newToolStates[toolCallId];
      return { toolStates: newToolStates };
    }),
}));
