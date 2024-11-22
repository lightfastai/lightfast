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
import { PropertyInspector } from "../inspector/property-inspector";
import { GeometryNode } from "../nodes/geometry-node";
import { MaterialNode } from "../nodes/material-node";

interface WorkspacePageProps {
  params: {
    id: RouterInputs["workspace"]["get"]["id"];
  };
}

const nodeTypes: NodeTypes = {
  geometry: GeometryNode,
  material: MaterialNode,
} as const;

export const Workspace = ({ params }: WorkspacePageProps) => {
  const { id } = params;
  const { handleMouseMove, render } = useWorkspaceNodeSelectionPreview();
  const { nodes } = useNodeStore((state) => state);
  const { onNodesChange } = useWorkspaceUpdateNode({
    workspaceId: id,
  });
  const { onClick: onWorkspaceClick } = useWorkspaceAddNode({
    workspaceId: id,
  });
  const { onNodesDelete } = useWorkspaceDeleteNode({
    workspaceId: id,
  });

  return (
    <main className="relative flex-1 overflow-hidden">
      <div className="relative h-full w-full">
        <ReactFlow
          nodes={nodes}
          onNodesChange={onNodesChange}
          onNodesDelete={onNodesDelete}
          nodeTypes={nodeTypes}
          onClick={onWorkspaceClick}
          onMouseMove={handleMouseMove}
          connectionMode={ConnectionMode.Loose}
          selectionOnDrag={false}
          panOnScroll={true}
          zoomOnScroll={false}
          proOptions={{ hideAttribution: true }}
        >
          {render()}

          <Background variant={BackgroundVariant.Dots} />
          <Panel position="bottom-right">
            <InfoCard
              title="Workspace Info"
              items={[{ label: "nodes", value: nodes.length }]}
            />
          </Panel>
        </ReactFlow>
        <PropertyInspector />
      </div>
    </main>
  );
};
