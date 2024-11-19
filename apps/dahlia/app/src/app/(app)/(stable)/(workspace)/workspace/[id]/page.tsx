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

import type {
  FlowNode,
  GeometryFlowNode,
  TempFlowNode,
} from "../types/flow-nodes";
import { api } from "~/trpc/react";
import { TempNode } from "../components/workspace/nodes/temp-node";
import { DEFAULT_GEOMETRY_NODE, isTempFlowNode } from "../types/flow-nodes";

interface WorkspacePageProps {
  params: {
    id: string;
  };
}

const nodeTypes: NodeTypes = {
  geometry: GeometryNode,
  temp: TempNode,
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
  const [tempNodes, setTempNodes] = useState<TempFlowNode[]>([]);

  const updateNodesMutation = api.workspace.updateNodes.useMutation();

  // Initialize nodes from workspace data
  useEffect(() => {
    if (workspaceNodes && !isLoading) {
      setNodes(workspaceNodes);
    }
  }, [workspaceNodes, isLoading, setNodes]);

  // Only update nodes in DB if they're not temporary
  const debouncedUpdateNodes = useCallback(
    debounce((newNodes: FlowNode[]) => {
      const persistentNodes = newNodes.filter(
        (node) => !isTempFlowNode(node),
      ) as GeometryFlowNode[];

      console.log("Persistent Nodes being sent to update:", persistentNodes);

      if (persistentNodes.length > 0) {
        updateNodesMutation.mutate({
          id,
          nodes: persistentNodes,
        });
      }
    }, 500),
    [id, updateNodesMutation],
  );

  // Update handleNodesChange to exclude temp nodes before debouncing
  const handleNodesChange = useCallback(
    (changes: any) => {
      onNodesChange(changes);
      // Get the latest nodes after the change
      setNodes((currentNodes) => {
        const nonTempNodes = currentNodes.filter(
          (node) => !isTempFlowNode(node),
        );
        debouncedUpdateNodes(nonTempNodes);
        return currentNodes;
      });
    },
    [debouncedUpdateNodes, onNodesChange, setNodes],
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

  return (
    <main className="relative flex-1 overflow-hidden">
      <div className="relative h-full w-full">
        <ReactFlow
          nodes={[...nodes, ...tempNodes]}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          deleteKeyCode={null}
          panOnDrag={true}
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
