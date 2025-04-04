import type { OnEdgesChange } from "@xyflow/react";
import { applyEdgeChanges } from "@xyflow/react";
import { createStore } from "zustand";

import type { InsertEdge } from "@vendor/db/schema";
import { prepareEdgeForInsert } from "@vendor/db/schema";

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
      try {
        // Use the new prepareEdgeForInsert for validation
        const validEdge = prepareEdgeForInsert({
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
        } as InsertEdge) as unknown as BaseEdge;

        set((state) => ({
          edges: [
            ...state.edges,
            {
              ...edge,
              sourceHandle: validEdge.sourceHandle,
              targetHandle: validEdge.targetHandle,
            },
          ],
        }));
      } catch (error) {
        console.error("Invalid edge:", error, edge);
      }
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
      try {
        // Validate all edges using prepareEdgeForInsert
        const validEdges = edges.map((edge) => {
          const validEdge = prepareEdgeForInsert({
            source: edge.source,
            target: edge.target,
            sourceHandle: edge.sourceHandle,
            targetHandle: edge.targetHandle,
          } as InsertEdge) as unknown as BaseEdge;

          return {
            ...edge,
            sourceHandle: validEdge.sourceHandle,
            targetHandle: validEdge.targetHandle,
          };
        });
        set({ edges: validEdges });
      } catch (error) {
        console.error("Some edges had invalid handles:", error);
      }
    },
  }));
};
