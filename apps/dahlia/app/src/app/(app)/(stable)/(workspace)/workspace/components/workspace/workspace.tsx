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

import { useAddEdge } from "../../hooks/use-add-edge";
import { useNodeAddEdge } from "../../hooks/use-node-add-edge";
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
  const { onConnect } = useNodeAddEdge();
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

      // Handle Node Deletions recursively
      if (nodesToDelete.length > 0) {
        const updated = nodesToDelete.reduce(async (accPromise, node) => {
          const acc = await accPromise;
          const incomers = getIncomers(node, acc.nodes, acc.edges);
          const outgoers = getOutgoers(node, acc.nodes, acc.edges);

          const connectionsToRecreate: Connection[] = incomers.flatMap(
            (incomer) =>
              outgoers.map(
                (outgoer) =>
                  ({
                    source: incomer.id,
                    target: outgoer.id,
                  }) as Connection,
              ),
          );

          // Remove the node from the accumulated nodes and related edges
          const filteredNodes = acc.nodes.filter((n) => n.id !== node.id);
          const filteredEdges = acc.edges.filter(
            (e) => e.source !== node.id && e.target !== node.id,
          );

          // Add new connections to the accumulated edges
          const newEdges = connectionsToRecreate.map((connection) => ({
            id: nanoid(),
            source: connection.source,
            target: connection.target,
          }));

          return {
            nodes: filteredNodes,
            edges: [...filteredEdges, ...newEdges],
          };
        }, Promise.resolve({ nodes, edges }));

        const { nodes: newNodes, edges: newEdges } = await updated;

        // **Separate Promise.all calls to ensure deletions complete before additions**
        for (const node of nodesToDelete) {
          await deleteNodeMutate({ id: node.id });
        }

        for (const edge of newEdges) {
          await addEdgeMutate({
            id: edge.id,
            edge: {
              source: edge.source,
              target: edge.target,
            },
          });
        }
      }
    },
    [nodes, edges, deleteEdgeMutate, deleteNodeMutate, addEdgeMutate],
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
