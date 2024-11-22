import { NodeChange } from "@xyflow/react";
import { createStore } from "zustand";

import { BaseNode } from "../types/node";

interface NodeState {
  nodes: BaseNode[];
}

export type NodeActions = {
  addNode: (node: BaseNode) => void;
  deleteNode: (id: string) => void;
  onNodesChange: (changes: NodeChange[]) => void;
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
      set((state) => {
        changes.forEach((change) => {
          /**
           * @todo: handle other change types
           */
          if (change.type === "position") {
            state.nodes = state.nodes.map((node) => {
              if (node.id === change.id && change.position) {
                return { ...node, position: change.position };
              }
              return node;
            });
          }
        });
        return { nodes: state.nodes };
      }),
  }));
};
