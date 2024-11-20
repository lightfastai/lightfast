"use client";

import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  NodeTypes,
  Panel,
  ReactFlow,
} from "@xyflow/react";

import { InfoCard } from "@repo/ui/components/info-card";

import { PropertyInspector } from "../components/inspector/property-inspector";
import { TextureRenderPipeline } from "../components/webgl/texture-render-pipeline";
import { WebGLCanvas } from "../components/webgl/webgl-canvas";
import { GeometryNode } from "../components/workspace/nodes/geometry-node";
import { useWorkspaceFlow } from "../components/workspace/use-workspace-flow";
import { useWorkspaceSelectionPreview } from "../components/workspace/use-workspace-selection-preview";
import { useGetWorkspaceNodes } from "../hooks/use-get-workspace-nodes";

import "@xyflow/react/dist/base.css";
import "../components/workspace/workspace.css";

import { RouterInputs } from "@repo/api";

import { NetworkEditorContext } from "../state/context";

interface WorkspacePageProps {
  params: {
    id: RouterInputs["workspace"]["get"]["id"];
  };
}

const nodeTypes: NodeTypes = {
  geometry: GeometryNode,
} as const;

export default function WorkspacePage({ params }: WorkspacePageProps) {
  const { id } = params;
  const state = NetworkEditorContext.useSelector((state) => state);
  const { data: workspaceNodes, isLoading } = useGetWorkspaceNodes({
    workspaceId: id,
  });

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    handleCanvasClick,
    onNodesDelete,
  } = useWorkspaceFlow({
    initialNodes: workspaceNodes ?? [],
    workspaceId: id,
  });

  const { render, handleMouseMove } = useWorkspaceSelectionPreview({
    active: !!state.context.selectedGeometry,
  });

  return (
    <main className="relative flex-1 overflow-hidden">
      <div className="relative h-full w-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodesDelete={onNodesDelete}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          onClick={handleCanvasClick}
          onMouseMove={handleMouseMove}
          connectionMode={ConnectionMode.Loose}
          panOnDrag={!state.context.selectedGeometry}
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
              items={[
                { label: "nodes", value: nodes.length },
                { label: "edges", value: edges.length },
              ]}
            />
          </Panel>
        </ReactFlow>
      </div>
      <PropertyInspector />
      <WebGLCanvas>
        <TextureRenderPipeline />
      </WebGLCanvas>
    </main>
  );
}
