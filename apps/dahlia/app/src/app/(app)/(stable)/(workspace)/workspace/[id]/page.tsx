"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  Connection,
  ConnectionMode,
  Edge,
  NodeTypes,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";

import { InfoCard } from "@repo/ui/components/info-card";

import { PropertyInspector } from "../components/inspector/property-inspector";
import { TextureRenderPipeline } from "../components/webgl/texture-render-pipeline";
import { WebGLCanvas } from "../components/webgl/webgl-canvas";
import { GeometryNode } from "../components/workspace/nodes/geometry-node";
import { useWorkspaceSelectionPreview } from "../components/workspace/use-workspace-selection-preview";
import { useGetWorkspaceNodes } from "../hooks/use-get-workspace-nodes";

import "@xyflow/react/dist/base.css";
import "../components/workspace/workspace.css";

import { RouterInputs } from "@repo/api";
import { GeometryType } from "@repo/db/schema";

import type { FlowNode, GeometryFlowNode } from "../types/flow-nodes";
import { NetworkEditorContext } from "../state/context";
import { DEFAULT_GEOMETRY_NODE } from "../types/flow-nodes";

interface WorkspacePageProps {
  params: {
    id: RouterInputs["workspace"]["get"]["id"];
  };
}

const nodeTypes: NodeTypes = {
  geometry: GeometryNode,
} as const;

interface FlowEdge extends Edge {
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export default function WorkspacePage({ params }: WorkspacePageProps) {
  const { id } = params;
  const state = NetworkEditorContext.useSelector((state) => state);
  const machineRef = NetworkEditorContext.useActorRef();
  const { data: workspaceNodes, isLoading } = useGetWorkspaceNodes({ id });
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);
  const [pendingGeometry, setPendingGeometry] = useState<GeometryType | null>(
    null,
  );
  const { render, handleMouseMove } = useWorkspaceSelectionPreview({
    active: !!pendingGeometry,
  });
  const { screenToFlowPosition } = useReactFlow();

  // const updateNodesMutation = api.workspace.updateNodes.useMutation();

  // Initialize nodes from workspace data
  useEffect(() => {
    if (workspaceNodes && !isLoading) {
      setNodes(workspaceNodes);
    }
  }, [workspaceNodes, isLoading, setNodes]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges],
  );

  useEffect(() => {
    if (state.context.selectedGeometry) {
      setPendingGeometry(state.context.selectedGeometry);
    }
  }, [state.context.selectedGeometry]);

  const onAddNode = useCallback(() => {
    const newNode: GeometryFlowNode = {
      id: `geometry-${Math.random()}`,
      position: { x: 100, y: 100 },
      ...DEFAULT_GEOMETRY_NODE,
    };
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes]);

  const handleCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!pendingGeometry) return;

      // Get ReactFlow instance to convert screen to flow coordinates
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: GeometryFlowNode = {
        id: `geometry-${Math.random()}`,
        position,
        ...DEFAULT_GEOMETRY_NODE,
        data: {
          ...DEFAULT_GEOMETRY_NODE.data,
          label: pendingGeometry,
          geometry: {
            ...DEFAULT_GEOMETRY_NODE.data.geometry,
            type: pendingGeometry,
          },
        },
      };

      setNodes((nds) => [...nds, newNode]);
      setPendingGeometry(null);
      machineRef.send({ type: "UNSELECT_GEOMETRY" });
    },
    [pendingGeometry, setNodes, screenToFlowPosition],
  );

  return (
    <main className="relative flex-1 overflow-hidden">
      <div className="relative h-full w-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          onClick={handleCanvasClick}
          onMouseMove={handleMouseMove}
          connectionMode={ConnectionMode.Loose}
          // deleteKeyCode={null}
          panOnDrag={!pendingGeometry}
          selectionOnDrag={false}
          panOnScroll={false}
          zoomOnScroll={false}
          proOptions={{ hideAttribution: true }}
        >
          {render()}

          <Background variant={BackgroundVariant.Dots} />
          <Panel position="bottom-left">
            <button
              onClick={onAddNode}
              className="rounded bg-blue-500 px-4 py-2 text-white"
            >
              Add Geometry Node
            </button>
          </Panel>
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
