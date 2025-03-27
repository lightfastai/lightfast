"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useRef } from "react";
import { useStore } from "zustand";

import type { EditorStore } from "../stores/editor-store";
import { createEditorStore, initEditorState } from "../stores/editor-store";

export type EditorStoreApi = ReturnType<typeof createEditorStore>;

export const EditorStoreContext = createContext<EditorStoreApi | undefined>(
  undefined,
);

export interface EditorStoreProviderProps {
  children: ReactNode;
}

export const EditorStoreProvider = ({ children }: EditorStoreProviderProps) => {
  const storeRef = useRef<EditorStoreApi>();
  if (!storeRef.current) {
    storeRef.current = createEditorStore(initEditorState());
  }

  return (
    <EditorStoreContext.Provider value={storeRef.current}>
      {children}
    </EditorStoreContext.Provider>
  );
};

export const useEditorStore = <T,>(selector: (store: EditorStore) => T): T => {
  const editorStoreContext = useContext(EditorStoreContext);

  if (!editorStoreContext) {
    throw new Error(`useEditorStore must be used within EditorStoreProvider`);
  }

  return useStore(editorStoreContext, selector);
};
