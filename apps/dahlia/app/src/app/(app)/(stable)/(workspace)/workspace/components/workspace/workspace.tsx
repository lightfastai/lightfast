"use client";

import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  NodeTypes,
  Panel,
  ReactFlow,
} from "@xyflow/react";

import "@xyflow/react/dist/base.css";
import "./workspace.css";

import { RouterInputs } from "@repo/api";
import { InfoCard } from "@repo/ui/components/info-card";

import { useWorkspaceAddNode } from "../../hooks/use-workspace-add-node";
import { useWorkspaceDeleteNode } from "../../hooks/use-workspace-delete-node";
import { useWorkspaceNodeSelectionPreview } from "../../hooks/use-workspace-node-selection-preview";
import { useWorkspaceUpdateNode } from "../../hooks/use-workspace-update-node";
import { useNodeStore } from "../../providers/node-store-provider";
import { useSelectionStore } from "../../providers/selection-store-provider";
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
  const { handleMouseMove, render } = useWorkspaceNodeSelectionPreview();
  const { onNodesChange: onWorkspaceNodesChange } = useWorkspaceUpdateNode({
    workspaceId: id,
  });
  const { onClick: onWorkspaceClick } = useWorkspaceAddNode({
    workspaceId: id,
  });
  const { onNodesDelete } = useWorkspaceDeleteNode();

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

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        onNodesChange={onWorkspaceNodesChange}
        onNodesDelete={onNodesDelete}
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
