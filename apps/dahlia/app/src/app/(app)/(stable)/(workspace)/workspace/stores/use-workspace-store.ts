import { Connection, Edge, NodeChange, XYPosition } from "@xyflow/react";
import { create } from "zustand";

import { FlowNode } from "../types/flow-nodes";

interface WorkspaceState {
  nodes: FlowNode[];
  edges: Edge[];
  selectedNodeIds: string[];

  // Actions
  setNodes: (nodes: FlowNode[]) => void;
  setEdges: (edges: Edge[]) => void;
  updateNodePositions: (
    nodePositions: { id: string; position: XYPosition }[],
  ) => void;
  addNode: (node: FlowNode) => void;
  deleteNodes: (nodeIds: string[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: Edge[]) => void;
  onConnect: (connection: Connection) => void;
  selectNodes: (nodeIds: string[]) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  nodes: [],
  edges: [],
  selectedNodeIds: [],

  setNodes: (nodes) => set({ nodes }),

  setEdges: (edges) => set({ edges }),

  updateNodePositions: (nodePositions) => {
    set((state) => ({
      nodes: state.nodes.map((node) => {
        const newPosition = nodePositions.find(
          (pos) => pos.id === node.id,
        )?.position;
        if (newPosition) {
          return { ...node, position: newPosition };
        }
        return node;
      }),
    }));
  },

  addNode: (node) => {
    set((state) => ({
      nodes: [...state.nodes, node],
    }));
  },

  deleteNodes: (nodeIds) => {
    set((state) => ({
      nodes: state.nodes.filter((node) => !nodeIds.includes(node.id)),
      edges: state.edges.filter(
        (edge) =>
          !nodeIds.includes(edge.source) && !nodeIds.includes(edge.target),
      ),
    }));
  },

  onNodesChange: (changes) => {
    set((state) => {
      const newNodes = [...state.nodes];
      changes.forEach((change) => {
        if (change.type === "position" && change.position) {
          const nodeIndex = newNodes.findIndex((n) => n.id === change.id);
          if (nodeIndex !== -1) {
            newNodes[nodeIndex] = {
              ...newNodes[nodeIndex],
              position: change.position,
              type: newNodes[nodeIndex].type,
            } as FlowNode;
          }
        }
      });
      return { nodes: newNodes };
    });
  },

  onEdgesChange: (edges) => {
    set({ edges });
  },

  onConnect: (connection) => {
    set((state) => ({
      edges: [
        ...state.edges,
        {
          id: `${connection.source}-${connection.target}`,
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle,
          targetHandle: connection.targetHandle,
        },
      ],
    }));
  },

  selectNodes: (nodeIds) => {
    set({ selectedNodeIds: nodeIds });
  },
}));
