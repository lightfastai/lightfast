import type { ReactNode } from "react";
import React from "react";
import {
  Background,
  BackgroundVariant,
  Connection,
  ConnectionMode,
  Controls,
  Edge,
  NodeTypes,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import { InfoCard } from "@repo/ui/components/info-card";

import { NetworkEditorContext } from "~/app/(app)/(stable)/(network-editor)/state/context";
import { GRID_SIZE, MAX_ZOOM, MIN_ZOOM, ZOOM_SPEED } from "./_defaults";
import { GeometryNode } from "./nodes/geometry-node";
import { CursorPosition } from "./types";

interface ConnectionInProgress {
  sourceId: string;
  sourcePos: { x: number; y: number };
}

interface WorkspaceRenderHelpers {
  zoom: number;
  cursorPosition: CursorPosition;
  gridSize: number;
  setStopPropagation: React.Dispatch<React.SetStateAction<boolean>>;
  isSelecting: boolean;
  renderNode: (params: {
    id: number;
    x: number;
    y: number;
    isSelected: boolean;
    onClick?: (e: React.MouseEvent) => void;
    children: ReactNode;
  }) => ReactNode;
}

interface WorkspaceProps {
  children: (helpers: WorkspaceRenderHelpers) => ReactNode;
  connections: Connection[];
  connectionInProgress?: ConnectionInProgress;
  onSelect?: (start: CursorPosition, end: CursorPosition, zoom: number) => void;
  debug?: boolean;
  maxZoom?: number;
  minZoom?: number;
  zoomSpeed?: number;
  gridSize?: number;
}

const nodeTypes: NodeTypes = {
  geometry: GeometryNode,
} as const;

interface FlowEdge extends Edge {
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

const INITIAL_NODES = [
  {
    id: "1",
    type: "geometry",
    data: { geometryId: 1 },
    position: { x: 0, y: 0 },
  },
];

export const Workspace = ({
  debug = false,
  maxZoom = MAX_ZOOM,
  minZoom = MIN_ZOOM,
  zoomSpeed = ZOOM_SPEED,
  gridSize = GRID_SIZE,
}: WorkspaceProps) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);

  const geometries = NetworkEditorContext.useSelector(
    (state) => state.context.geometries,
  );

  // useEffect(() => {
  //   const geometryNodes = geometries.map((geometry) => ({
  //     id: `geometry-${geometry.id}`,
  //     type: "geometryNode",
  //     position: { x: geometry.position?.x || 0, y: geometry.position?.y || 0 },
  //     data: {
  //       geometryId: geometry.id,
  //       geometry,
  //     },
  //   }));

  //   setNodes(geometryNodes);
  // }, [geometries, setNodes]);

  // useEffect(() => {
  //   const rfEdges = connections.map((conn) => ({
  //     id: `${conn.sourceId}-${conn.targetId}`,
  //     source: conn.sourceId,
  //     target: conn.targetId,
  //     type: "smoothstep",
  //   }));
  //   setEdges(rfEdges);
  // }, [connections, setEdges]);

  // const onConnect = useCallback(
  //   (params: Connection) => {
  //     setEdges((eds) => addEdge(params, eds));
  //   },
  //   [setEdges],
  // );

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={INITIAL_NODES}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        // onConnect={onConnect}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        minZoom={minZoom}
        maxZoom={maxZoom}
        fitView
        style={{
          background: "hsl(var(--background))",
        }}
        defaultEdgeOptions={{
          type: "smoothstep",
          style: {
            strokeWidth: 2,
          },
        }}
        colorMode="dark"
      >
        <Background
          gap={gridSize}
          size={1}
          variant={BackgroundVariant.Dots}
          color="hsl(var(--muted-foreground))"
        />
        <Controls showZoom={true} showFitView={true} showInteractive={false} />
        {debug && (
          <Panel position="bottom-right">
            <InfoCard
              title="Workspace Info"
              items={[
                { label: "gridSize", value: gridSize },
                { label: "zoom", value: nodes.length },
                { label: "edges", value: edges.length },
              ]}
            />
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
};
