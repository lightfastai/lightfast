"use client";

import type { Connection, NodeTypes, OnDelete } from "@xyflow/react";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  ReactFlow,
} from "@xyflow/react";

import "@xyflow/react/dist/base.css";
import "./workspace.css";

import { useCallback } from "react";

import type { BaseEdge, BaseNode } from "../../types/node";
import type { RouterInputs } from "~/trpc/server/index";
import { useAddEdge } from "../../hooks/use-add-edge";
import { useAddNode } from "../../hooks/use-add-node";
import { useDeleteEdge } from "../../hooks/use-delete-edge";
import { useDeleteNode } from "../../hooks/use-delete-node";
import { useReplaceEdge } from "../../hooks/use-replace-edge";
import { useUpdateNodes } from "../../hooks/use-update-nodes";
import { useWorkspaceNodeSelectionPreview } from "../../hooks/use-workspace-node-selection-preview";
import { useEdgeStore } from "../../providers/edge-store-provider";
import { useNodeStore } from "../../providers/node-store-provider";
import { useSelectionStore } from "../../providers/selection-store-provider";
import { Debug } from "../debug/debug";
import { FluxNode } from "../nodes/flux-node";
import { GeometryNode } from "../nodes/geometry-node";
import { MaterialNode } from "../nodes/material-node";
import { TextureNode } from "../nodes/texture-node";
import { WindowNode } from "../nodes/window-node";

interface WorkspacePageProps {
  params: {
    id: RouterInputs["tenant"]["workspace"]["get"]["id"];
  };
}

const nodeTypes: NodeTypes = {
  geometry: GeometryNode,
  material: MaterialNode,
  texture: TextureNode,
  flux: FluxNode,
  window: WindowNode,
};

export const Workspace = ({ params }: WorkspacePageProps) => {
  const { id } = params;
  const { nodes } = useNodeStore((state) => state);
  const { selection } = useSelectionStore((state) => state);
  const { edges, onEdgesChange } = useEdgeStore((state) => state);
  const { handleMouseMove, render } = useWorkspaceNodeSelectionPreview();
  const { onNodesChange } = useUpdateNodes({
    workspaceId: id,
  });
  const { onClick: onWorkspaceClick } = useAddNode({
    workspaceId: id,
  });
  const { mutateAsync: deleteEdgeMutate } = useDeleteEdge();
  const { mutateAsync: deleteNodeMutate } = useDeleteNode();
  const { mutateAsync: addEdgeMutate } = useAddEdge();
  const { mutateAsync: replaceEdgeMutate } = useReplaceEdge();

  // A wrapper around onWorkspaceClick for safety where if selection is undefined,
  // we don't want to add a node
  const onClick = (event: React.MouseEvent) => {
    if (!selection) return;
    onWorkspaceClick(event);
  };

  // A wrapper around onMouseMove for safety where if selection is undefined,
  // we don't want to update the preview
  const onMouseMove = (event: React.MouseEvent) => {
    if (!selection) return;
    handleMouseMove(event);
  };

  // Combined onDelete handler handling both node and edge deletions
  const onDelete: OnDelete<BaseNode, BaseEdge> = useCallback(
    async ({ nodes: nodesToDelete, edges: edgesToDelete }) => {
      // If there are no nodes or edges to delete, do nothing
      if (nodesToDelete.length === 0 && edgesToDelete.length === 0) return;

      // Handle Edge Deletions if there are no nodes to delete
      if (nodesToDelete.length === 0 && edgesToDelete.length > 0) {
        await Promise.all(
          edgesToDelete.map((edge) => deleteEdgeMutate({ id: edge.id })),
        );
      }

      // Handle Node Deletions if there are no edges to delete
      // CASCADE DELETION of all connected edges
      if (nodesToDelete.length > 0) {
        await Promise.all(
          nodesToDelete.map((node) => deleteNodeMutate({ id: node.id })),
        );
      }
    },
    [deleteEdgeMutate, deleteNodeMutate, addEdgeMutate],
  );

  const onConnect = useCallback(
    async (params: Connection) => {
      // Find any existing edge that connects TO the target node
      const existingEdge = edges.find((edge) => edge.target === params.target);

      if (existingEdge) {
        // Replace the existing edge (regardless of its source)
        await replaceEdgeMutate(existingEdge.id, params);
      } else {
        // Add a new edge if the target has no incoming edges
        await addEdgeMutate(params);
      }
    },
    [replaceEdgeMutate, addEdgeMutate, edges],
  );

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onEdgesChange={onEdgesChange}
        onNodesChange={onNodesChange}
        onDelete={onDelete}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        onClick={onClick}
        onMouseMove={onMouseMove}
        connectionMode={ConnectionMode.Loose}
        selectionOnDrag={false}
        panOnScroll={true}
        zoomOnScroll={false}
        proOptions={{ hideAttribution: true }}
        minZoom={0.25}
      >
        {selection && render()}
        <Background variant={BackgroundVariant.Dots} />
        <Debug />
      </ReactFlow>
    </div>
  );
};
