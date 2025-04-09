"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useRef } from "react";
import { useStore } from "zustand";

import type { EdgeStore } from "../stores/edge-store";
import type { BaseEdge } from "../types/edge";
import { createEdgeStore } from "../stores/edge-store";

export type EdgeStoreApi = ReturnType<typeof createEdgeStore>;

export const EdgeStoreContext = createContext<EdgeStoreApi | undefined>(
  undefined,
);

export interface EdgeStoreProviderProps {
  children: ReactNode;
  initialEdges: BaseEdge[];
}

export const EdgeStoreProvider = ({
  children,
  initialEdges,
}: EdgeStoreProviderProps) => {
  const storeRef = useRef<EdgeStoreApi>();
  if (!storeRef.current) {
    storeRef.current = createEdgeStore({ edges: initialEdges });
  }

  return (
    <EdgeStoreContext.Provider value={storeRef.current}>
      {children}
    </EdgeStoreContext.Provider>
  );
};

export const useEdgeStore = <T,>(selector: (store: EdgeStore) => T): T => {
  const edgeStoreContext = useContext(EdgeStoreContext);

  if (!edgeStoreContext) {
    throw new Error(`useEdgeStore must be used within EdgeStoreProvider`);
  }

  return useStore(edgeStoreContext, selector);
};
