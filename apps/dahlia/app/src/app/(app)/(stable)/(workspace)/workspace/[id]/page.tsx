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

import { EditorCommandDialog } from "../components/app/editor-command-dialog";
import { PropertyInspector } from "../components/inspector/property-inspector";
import { TextureRenderPipeline } from "../components/webgl/texture-render-pipeline";
import { WebGLCanvas } from "../components/webgl/webgl-canvas";
import { GeometryNode } from "../components/workspace/nodes/geometry-node";
import { PendingGeometryPreview } from "../components/workspace/pending-geometry-preview";
import { useGetWorkspace } from "../hooks/use-get-workspace";
import { useGetWorkspaceNodes } from "../hooks/use-get-workspace-nodes";

import "@xyflow/react/dist/base.css";
import "../components/workspace/workspace.css";

import type { FlowNode, GeometryFlowNode } from "../types/flow-nodes";
import { api } from "~/trpc/react";
import { DEFAULT_GEOMETRY_NODE } from "../types/flow-nodes";

interface WorkspacePageProps {
  params: {
    id: string;
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
  const workspace = useGetWorkspace({ id });
  const { data: workspaceNodes, isLoading } = useGetWorkspaceNodes({ id });
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);
  const [pendingGeometry, setPendingGeometry] = useState<string | null>(null);
  const { screenToFlowPosition } = useReactFlow();

  const updateNodesMutation = api.workspace.updateNodes.useMutation();

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

  const onAddNode = useCallback(() => {
    const newNode: GeometryFlowNode = {
      id: `geometry-${Math.random()}`,
      position: { x: 100, y: 100 },
      ...DEFAULT_GEOMETRY_NODE,
    };
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes]);

  const handleGeometrySelect = useCallback((geometryType: string) => {
    setPendingGeometry(geometryType);
  }, []);

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
            type: pendingGeometry.toLowerCase() as "box" | "sphere" | "plane",
          },
        },
      };

      setNodes((nds) => [...nds, newNode]);
      setPendingGeometry(null);
    },
    [pendingGeometry, setNodes, screenToFlowPosition],
  );

  return (
    <main className="relative flex-1 overflow-hidden">
      <EditorCommandDialog onGeometrySelect={handleGeometrySelect} />
      <PendingGeometryPreview geometryType={pendingGeometry} />

      <div className="relative h-full w-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          onClick={handleCanvasClick}
          connectionMode={ConnectionMode.Loose}
          deleteKeyCode={null}
          panOnDrag={!pendingGeometry} // Disable panning when placing a node
          selectionOnDrag={false}
          panOnScroll={false}
          zoomOnScroll={false}
          proOptions={{ hideAttribution: true }}
        >
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

// Utility function for debouncing
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
