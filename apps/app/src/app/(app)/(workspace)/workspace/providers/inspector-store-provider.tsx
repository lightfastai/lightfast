"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useRef } from "react";
import { useStore } from "zustand";

import type { InspectorStore } from "../stores/inspector-store";
import {
  createInspectorStore,
  initInspectorState,
} from "../stores/inspector-store";

export type InspectorStoreApi = ReturnType<typeof createInspectorStore>;

export const InspectorStoreContext = createContext<
  InspectorStoreApi | undefined
>(undefined);

export interface InspectorStoreProviderProps {
  children: ReactNode;
}

export const InspectorStoreProvider = ({
  children,
}: InspectorStoreProviderProps) => {
  const storeRef = useRef<InspectorStoreApi>();
  if (!storeRef.current) {
    storeRef.current = createInspectorStore(initInspectorState());
  }

  return (
    <InspectorStoreContext.Provider value={storeRef.current}>
      {children}
    </InspectorStoreContext.Provider>
  );
};

export const useInspectorStore = <T,>(
  selector: (store: InspectorStore) => T,
): T => {
  const inspectorStoreContext = useContext(InspectorStoreContext);

  if (!inspectorStoreContext) {
    throw new Error(
      `useInspectorStore must be used within InspectorStoreProvider`,
    );
  }

  return useStore(inspectorStoreContext, selector);
};
