import { createStore } from "zustand";

interface EditorState {
  isCommandDialogOpen: boolean;
}

export type EditorActions = {
  setIsCommandDialogOpen: (isOpen: boolean) => void;
};

export type EditorStore = EditorState & EditorActions;

export const initEditorState = (): EditorState => ({
  isCommandDialogOpen: false,
});

export const defaultEditorState: EditorState = {
  isCommandDialogOpen: false,
};

export const createEditorStore = (
  initState: EditorState = defaultEditorState,
) => {
  return createStore<EditorStore>()((set) => ({
    ...initState,
    setIsCommandDialogOpen: (isOpen) => set({ isCommandDialogOpen: isOpen }),
  }));
};
