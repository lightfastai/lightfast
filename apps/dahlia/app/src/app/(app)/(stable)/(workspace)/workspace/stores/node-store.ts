import { applyNodeChanges, OnNodesChange } from "@xyflow/react";
import { createStore } from "zustand";

import { BaseNode } from "../types/node";

interface NodeState {
  nodes: BaseNode[];
}

export type NodeActions = {
  addNode: (node: BaseNode) => void;
  deleteNode: (id: string) => void;
  onNodesChange: OnNodesChange<BaseNode>;
};

export type NodeStore = NodeState & NodeActions;

export const initNodeState = (nodes: BaseNode[]): NodeState => ({
  nodes,
});

export const defaultNodeState: NodeState = {
  nodes: [],
};

export const createNodeStore = (initState: NodeState = defaultNodeState) => {
  return createStore<NodeStore>()((set) => ({
    ...initState,
    addNode: (node) => set((state) => ({ nodes: [...state.nodes, node] })),
    deleteNode: (id) =>
      set((state) => ({
        nodes: state.nodes.filter((n) => n.id !== id),
      })),
    onNodesChange: (changes) =>
      set((state) => ({
        nodes: applyNodeChanges(changes, state.nodes),
      })),
  }));
};
