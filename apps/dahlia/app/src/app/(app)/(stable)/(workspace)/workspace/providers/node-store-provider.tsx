"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useRef } from "react";
import { useStore } from "zustand";

import type { NodeStore } from "../stores/node-store";
import { createNodeStore } from "../stores/node-store";
import { BaseNode } from "../types/node";

export type NodeStoreApi = ReturnType<typeof createNodeStore>;

export const NodeStoreContext = createContext<NodeStoreApi | undefined>(
  undefined,
);

export interface NodeStoreProviderProps {
  children: ReactNode;
  initialNodes: BaseNode[];
}

export const NodeStoreProvider = ({
  children,
  initialNodes,
}: NodeStoreProviderProps) => {
  const storeRef = useRef<NodeStoreApi>();
  if (!storeRef.current) {
    storeRef.current = createNodeStore({ nodes: initialNodes });
  }

  return (
    <NodeStoreContext.Provider value={storeRef.current}>
      {children}
    </NodeStoreContext.Provider>
  );
};

export const useNodeStore = <T,>(selector: (store: NodeStore) => T): T => {
  const nodeStoreContext = useContext(NodeStoreContext);

  if (!nodeStoreContext) {
    throw new Error(`useNodeStore must be used within NodeStoreProvider`);
  }

  return useStore(nodeStoreContext, selector);
};
