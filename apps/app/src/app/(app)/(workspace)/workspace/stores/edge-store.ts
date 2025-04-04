import type { OnEdgesChange } from "@xyflow/react";
import { applyEdgeChanges } from "@xyflow/react";
import { createStore } from "zustand";

import { validateEdgeHandles } from "@vendor/db/schema";

import type { BaseEdge } from "../types/node";

interface EdgeState {
  edges: BaseEdge[];
}

export interface EdgeActions {
  addEdge: (edge: BaseEdge) => void;
  deleteEdge: (id: string) => void;
  onEdgesChange: OnEdgesChange<BaseEdge>;
  setEdges: (edges: BaseEdge[]) => void;
}

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
    addEdge: (edge) => {
      // Validate edge handles before adding
      if (!validateEdgeHandles(edge)) {
        console.error("Invalid edge handles:", edge);
        return;
      }
      set((state) => ({ edges: [...state.edges, edge] }));
    },
    deleteEdge: (id) =>
      set((state) => ({
        edges: applyEdgeChanges([{ id, type: "remove" }], state.edges),
      })),
    onEdgesChange: (changes) =>
      set((state) => ({
        edges: applyEdgeChanges(changes, state.edges),
      })),
    setEdges: (edges) => {
      // Validate all edges before setting
      const validEdges = edges.filter((edge) => validateEdgeHandles(edge));
      if (validEdges.length !== edges.length) {
        console.error("Some edges had invalid handles");
      }
      set({ edges: validEdges });
    },
  }));
};
