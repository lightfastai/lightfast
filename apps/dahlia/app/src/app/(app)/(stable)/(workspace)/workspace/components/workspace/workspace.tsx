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

import { useGetWorkspaceNodes } from "../../hooks/use-get-workspace-nodes";
import { PropertyInspector } from "../inspector/property-inspector";
import { TextureRenderPipeline } from "../webgl/texture-render-pipeline";
import { WebGLCanvas } from "../webgl/webgl-canvas";
import { GeometryNode } from "./nodes/geometry-node";
import { MaterialNode } from "./nodes/material-node";

interface WorkspacePageProps {
  params: {
    id: RouterInputs["workspace"]["get"]["id"];
    initialNodeIds: string[];
  };
}

const nodeTypes: NodeTypes = {
  geometry: GeometryNode,
  material: MaterialNode,
} as const;

export const Workspace = ({ params }: WorkspacePageProps) => {
  const { id, initialNodeIds } = params;
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    handleCanvasClick,
    onNodesDelete,
  } = useGetWorkspaceNodes({
    workspaceId: id,
    initialNodeIds,
  });

  // const { render, handleMouseMove } = useWorkspaceSelectionPreview({
  //   active:
  //     !!NetworkEditorContext.useSelector((state) => state).context
  //       .selectedGeometry ||
  //     !!NetworkEditorContext.useSelector((state) => state).context
  //       .selectedMaterial,
  // });

  return (
    <main className="relative flex-1 overflow-hidden">
      <div className="relative h-full w-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onNodesDelete={onNodesDelete}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          onClick={handleCanvasClick}
          // onMouseMove={handleMouseMove}
          connectionMode={ConnectionMode.Loose}
          selectionOnDrag={false}
          panOnScroll={true}
          zoomOnScroll={false}
          proOptions={{ hideAttribution: true }}
        >
          {/* {render()} */}

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
        <PropertyInspector />
        <WebGLCanvas>
          <TextureRenderPipeline />
        </WebGLCanvas>
      </div>
    </main>
  );
};
