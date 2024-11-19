"use client";

import { useCallback, useEffect } from "react";
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
} from "@xyflow/react";

import { InfoCard } from "@repo/ui/components/info-card";

import { PropertyInspector } from "../components/inspector/property-inspector";
import { TextureRenderPipeline } from "../components/webgl/texture-render-pipeline";
import { WebGLCanvas } from "../components/webgl/webgl-canvas";
import { GeometryNode } from "../components/workspace/nodes/geometry-node";
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

  const updateNodesMutation = api.workspace.updateNodes.useMutation();

  // Initialize nodes from workspace data
  useEffect(() => {
    if (workspaceNodes && !isLoading) {
      setNodes(workspaceNodes);
    }
  }, [workspaceNodes, isLoading, setNodes]);

  // Handle node changes and persist to database
  const handleNodesChange = useCallback(
    (changes: any) => {
      onNodesChange(changes);
      // Debounce this in production
      updateNodesMutation.mutate({
        id,
        nodes: nodes,
      });
    },
    [nodes, id, updateNodesMutation, onNodesChange],
  );

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

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <main className="relative flex-1 overflow-hidden">
      <div className="relative h-full w-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
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
      <WebGLCanvas
        shadows
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: -1,
        }}
      >
        <TextureRenderPipeline />
      </WebGLCanvas>
    </main>
  );
}
