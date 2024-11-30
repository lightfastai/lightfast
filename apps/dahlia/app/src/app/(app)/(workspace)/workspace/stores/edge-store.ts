import { applyEdgeChanges, OnEdgesChange } from "@xyflow/react";
import { createStore } from "zustand";

import { BaseEdge } from "../types/node";

interface EdgeState {
  edges: BaseEdge[];
}

export type EdgeActions = {
  addEdge: (edge: BaseEdge) => void;
  deleteEdge: (id: string) => void;
  onEdgesChange: OnEdgesChange<BaseEdge>;
};

export type EdgeStore = EdgeState & EdgeActions;

export const initEdgeState = (edges: BaseEdge[]): EdgeState => ({
  edges,
});

export const defaultEdgeState: EdgeState = {
  edges: [],
};

export const createEdgeStore = (initState: EdgeState = defaultEdgeState) => {
  return createStore<EdgeStore>()((set) => ({
    ...initState,
    addEdge: (edge) => set((state) => ({ edges: [...state.edges, edge] })),
    deleteEdge: (id) =>
      set((state) => ({
        edges: applyEdgeChanges([{ id, type: "remove" }], state.edges),
      })),
    onEdgesChange: (changes) =>
      set((state) => ({
        edges: applyEdgeChanges(changes, state.edges),
      })),
  }));
};
