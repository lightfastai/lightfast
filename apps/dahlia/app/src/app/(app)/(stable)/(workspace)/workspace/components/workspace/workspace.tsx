"use client";

import {
  Background,
  BackgroundVariant,
  Connection,
  ConnectionMode,
  getIncomers,
  getOutgoers,
  NodeTypes,
  OnDelete,
  Panel,
  ReactFlow,
} from "@xyflow/react";

import "@xyflow/react/dist/base.css";
import "./workspace.css";

import { useCallback } from "react";

import { RouterInputs } from "@repo/api";
import { nanoid } from "@repo/lib";
import { InfoCard } from "@repo/ui/components/info-card";

import { useAddEdge } from "../../hooks/use-node-add-edge";
import { useWorkspaceAddNode } from "../../hooks/use-workspace-add-node";
import { useDeleteEdge } from "../../hooks/use-workspace-delete-edge";
import { useDeleteNode } from "../../hooks/use-workspace-delete-node";
import { useWorkspaceNodeSelectionPreview } from "../../hooks/use-workspace-node-selection-preview";
import { useWorkspaceUpdateNode } from "../../hooks/use-workspace-update-node";
import { useEdgeStore } from "../../providers/edge-store-provider";
import { useNodeStore } from "../../providers/node-store-provider";
import { useSelectionStore } from "../../providers/selection-store-provider";
import { BaseEdge, BaseNode } from "../../types/node";
import { GeometryNode } from "../nodes/geometry-node";
import { MaterialNode } from "../nodes/material-node";
import { TextureNode } from "../nodes/texture-node";

interface WorkspacePageProps {
  params: {
    id: RouterInputs["workspace"]["get"]["id"];
  };
}

const nodeTypes: NodeTypes = {
  geometry: GeometryNode,
  material: MaterialNode,
  texture: TextureNode,
} as const;

export const Workspace = ({ params }: WorkspacePageProps) => {
  const { id } = params;
  const { nodes } = useNodeStore((state) => state);
  const { selection } = useSelectionStore((state) => state);
  const { edges, onEdgesChange } = useEdgeStore((state) => state);
  const { handleMouseMove, render } = useWorkspaceNodeSelectionPreview();
  const { onNodesChange } = useWorkspaceUpdateNode({
    workspaceId: id,
  });
  const { onClick: onWorkspaceClick } = useWorkspaceAddNode({
    workspaceId: id,
  });
  const { mutateAsync: deleteEdgeMutate } = useDeleteEdge();
  const { mutateAsync: deleteNodeMutate } = useDeleteNode();
  const { mutateAsync: addEdgeMutate } = useAddEdge();

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

      if (nodesToDelete.length > 0) {
        let updatedNodes = [...nodes];
        let updatedEdges = [...edges];

        for (const node of nodesToDelete) {
          // Get incomers and outgoers before node removal
          const incomers = getIncomers(node, updatedNodes, updatedEdges);
          const outgoers = getOutgoers(node, updatedNodes, updatedEdges);

          // Remove the node from the updated nodes
          updatedNodes = updatedNodes.filter((n) => n.id !== node.id);
          // Remove edges connected to the node
          updatedEdges = updatedEdges.filter(
            (e) => e.source !== node.id && e.target !== node.id,
          );

          // **Prevent self-connections by filtering out connections where source === target**
          const connectionsToRecreate = incomers.flatMap((incomer) =>
            outgoers
              .filter((outgoer) => outgoer.id !== incomer.id)
              .map(
                (outgoer) =>
                  ({
                    source: incomer.id,
                    target: outgoer.id,
                  }) as Connection,
              ),
          );

          // Create new edges for the recreated connections
          const newEdges = connectionsToRecreate.map((connection) => ({
            id: nanoid(),
            source: connection.source,
            target: connection.target,
          }));

          // **Perform the node deletion mutation**
          await deleteNodeMutate({ id: node.id });

          console.log(newEdges);

          // **Add new edges mutations after node deletion**
          for (const edge of newEdges) {
            await addEdgeMutate(
              {
                source: edge.source,
                target: edge.target,
              } as Connection,
              updatedEdges,
              updatedNodes,
            );
            updatedEdges = [...updatedEdges, edge];
          }
        }
      }
    },
    [nodes, edges, deleteEdgeMutate, deleteNodeMutate, addEdgeMutate],
  );

  const onConnect = useCallback(
    async (params: Connection) => {
      await addEdgeMutate(params, edges, nodes);
    },
    [addEdgeMutate, edges, nodes],
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
        <Panel position="bottom-right">
          <InfoCard
            title="Workspace Info"
            items={[{ label: "nodes", value: nodes.length }]}
          />
        </Panel>
      </ReactFlow>
    </div>
  );
};
