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

import { toast } from "@repo/ui/hooks/use-toast";

import type { BaseEdge, BaseNode } from "../../types/node";
import type { RouterInputs } from "~/trpc/server/index";
import { useAddEdge } from "../../hooks/use-add-edge";
import { useAddNode } from "../../hooks/use-add-node";
import { useDeleteEdge } from "../../hooks/use-delete-edge";
import { useDeleteNode } from "../../hooks/use-delete-node";
import { useReplaceEdge } from "../../hooks/use-replace-edge";
import { useUpdateNodes } from "../../hooks/use-update-nodes";
import { useHandleTypeValidator } from "../../hooks/use-validate-edge";
import { useWorkspaceNodeSelectionPreview } from "../../hooks/use-workspace-node-selection-preview";
import { useEdgeStore } from "../../providers/edge-store-provider";
import { useNodeStore } from "../../providers/node-store-provider";
import { useSelectionStore } from "../../providers/selection-store-provider";
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
  const validateHandleTypes = useHandleTypeValidator();

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
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  const onDelete: OnDelete<BaseNode, BaseEdge> = useCallback(
    async ({ nodes: nodesToDelete, edges: edgesToDelete }) => {
      // If there are no nodes or edges to delete, do nothing
      if (nodesToDelete.length === 0 && edgesToDelete.length === 0) {
        return;
      }

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
    [deleteEdgeMutate, deleteNodeMutate],
  );

  const onConnect = useCallback(
    async (params: Connection) => {
      // Require explicit targetHandle for all connections
      if (!params.targetHandle) {
        toast({
          title: "Connection Failed",
          description: "Missing target handle specification",
          variant: "destructive",
        });
        return;
      }

      // Validate handle types (outputs must connect to inputs)
      if (!validateHandleTypes(params.sourceHandle, params.targetHandle)) {
        return;
      }

      // Find any existing edge that connects TO the same handle of the target node
      const existingEdge = edges.find(
        (edge) =>
          edge.target === params.target &&
          edge.targetHandle === params.targetHandle,
      );

      if (existingEdge) {
        // Replace the existing edge for this specific handle
        await replaceEdgeMutate(existingEdge.id, params);
      } else {
        // Add a new edge to this specific handle
        await addEdgeMutate(params);
      }
    },
    [replaceEdgeMutate, addEdgeMutate, edges, validateHandleTypes],
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
        connectionMode={ConnectionMode.Strict}
        selectionOnDrag={false}
        panOnScroll={true}
        zoomOnScroll={false}
        proOptions={{ hideAttribution: true }}
        minZoom={0.25}
      >
        {selection && render()}
        <Background variant={BackgroundVariant.Dots} />
      </ReactFlow>
    </div>
  );
};
