"use client";

import { useCallback, useMemo, useState } from "react";

import { cn } from "@repo/ui/lib/utils";

import { createPath } from "~/components/path-utils";
import { SelectionIndicator } from "~/components/selection-indicator";
import { NetworkGeometryNode } from "~/components/td-x-network-editor-geometry-node";
import { NetworkMaterialNode } from "~/components/td-x-network-editor-material-node";
import { NetworkTextureNode } from "~/components/td-x-network-editor-texture-node";
import { PropertyInspector } from "./components/inspector/property-inspector";
import { TextureRenderPipeline } from "./components/webgl/texture-render-pipeline";
import { WebGLCanvas } from "./components/webgl/webgl-canvas";
import { SelectionBox } from "./components/workspace/selection-box";
import { Workspace } from "./components/workspace/workspace";
import { useCreateGeometry } from "./hooks/use-create-geometry";
import { useCreateMaterial } from "./hooks/use-create-material";
import { useCreateTexture } from "./hooks/use-create-texture";
import { NetworkEditorContext } from "./state/context";

export default function Page() {
  const state = NetworkEditorContext.useSelector((state) => state);
  const machineRef = NetworkEditorContext.useActorRef();

  const { handleGeometryCreate } = useCreateGeometry();
  const { handleMaterialCreate } = useCreateMaterial();
  const { handleTextureCreate } = useCreateTexture();

  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState({ x: 0, y: 0 });
  const [selectionEnd, setSelectionEnd] = useState({ x: 0, y: 0 });

  const isNodeInSelection = useCallback(
    (nodeX: number, nodeY: number) => {
      const left = Math.min(selectionStart.x, selectionEnd.x);
      const right = Math.max(selectionStart.x, selectionEnd.x);
      const top = Math.min(selectionStart.y, selectionEnd.y);
      const bottom = Math.max(selectionStart.y, selectionEnd.y);

      return nodeX >= left && nodeX <= right && nodeY >= top && nodeY <= bottom;
    },
    [selectionStart, selectionEnd],
  );

  const isPlacingAny = useMemo(
    () =>
      [
        state.context.isPlacingGeometry && state.context.selectedGeometry,
        state.context.isPlacingMaterial && state.context.selectedMaterial,
        state.context.isPlacingTexture && state.context.selectedTexture,
      ].some(Boolean),
    [
      state.context.isPlacingGeometry,
      state.context.selectedGeometry,
      state.context.isPlacingMaterial,
      state.context.selectedMaterial,
      state.context.isPlacingTexture,
      state.context.selectedTexture,
    ],
  );

  return (
    <main className="relative flex-1 overflow-hidden">
      <Workspace debug>
        {({ cursorPosition: { x, y }, gridSize, setStopPropagation, zoom }) => (
          <div
            className={cn("h-full w-full")}
            onMouseDown={(e) => {
              if (e.button === 0) {
                setIsSelecting(true);
                setSelectionStart({ x, y });
                setSelectionEnd({ x, y });
              }
            }}
            onMouseMove={(e) => {
              if (isSelecting) {
                setSelectionEnd({ x, y });
              }
            }}
            onMouseUp={() => {
              if (isSelecting) {
                const selectedNodes = [
                  ...state.context.geometries,
                  ...state.context.materials,
                  ...state.context.textures,
                ].filter((node) => isNodeInSelection(node.x, node.y));

                if (selectedNodes.length > 0) {
                  console.log("Selected nodes:", selectedNodes);
                }

                setIsSelecting(false);
              }

              if (state.context.activeConnection) {
                machineRef.send({ type: "CANCEL_CONNECTION" });
              }
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                machineRef.send({ type: "DESELECT_ALL" });
              }

              if (state.context.isPlacingGeometry) {
                handleGeometryCreate(x, y);
              }

              if (state.context.isPlacingMaterial) {
                handleMaterialCreate(x, y);
              }

              if (state.context.isPlacingTexture) {
                handleTextureCreate(x, y);
              }
            }}
          >
            {/* Render permanent connections */}
            <svg
              className="pointer-events-none fixed inset-0 h-canvas-grid w-canvas-grid"
              style={{ zIndex: 0 }} // Changed from 999 to 0
            >
              {state.context.textures.map((texture) =>
                texture.outputs.map((targetId) => {
                  const targetNode = state.context.textures.find(
                    (t) => t.id === targetId,
                  );
                  if (!targetNode) return null;

                  return (
                    <path
                      key={`${texture.id}-${targetId}`}
                      d={createPath(
                        texture.outputPos.x,
                        texture.outputPos.y,
                        targetNode.inputPos.x,
                        targetNode.inputPos.y,
                      )}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1}
                    />
                  );
                }),
              )}
            </svg>

            {state.context.activeConnection && (
              <svg
                className="pointer-events-none fixed inset-0 h-canvas-grid w-canvas-grid"
                style={{ zIndex: 0 }} // Add zIndex: 0
              >
                <path
                  d={createPath(
                    state.context.textures.find(
                      (t) => t.id === state.context.activeConnection?.sourceId,
                    )?.outputPos.x ?? 0,
                    state.context.textures.find(
                      (t) => t.id === state.context.activeConnection?.sourceId,
                    )?.outputPos.y ?? 0,
                    x,
                    y,
                  )}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeDasharray="4"
                />
              </svg>
            )}

            {isSelecting && (
              <SelectionBox
                startX={selectionStart.x}
                startY={selectionStart.y}
                endX={selectionEnd.x}
                endY={selectionEnd.y}
              />
            )}

            {/* Render Geometries, Materials, and Textures with higher z-index */}
            <div style={{ position: "relative", zIndex: 1 }}>
              {/* Render Geometries */}
              {state.context.geometries.map((geometry) => (
                <div
                  key={geometry.id}
                  className={cn(
                    "absolute transition-all",
                    state.context.selectedNodeIds.find(
                      (id) => id === geometry.id,
                    ) && "ring-2 ring-blue-500",
                  )}
                  style={{
                    left: `${geometry.x}px`,
                    top: `${geometry.y}px`,
                  }}
                  onMouseEnter={() => setStopPropagation(true)}
                  onMouseLeave={() => setStopPropagation(false)}
                  onClick={(e) => {
                    e.stopPropagation();
                    machineRef.send({ type: "SELECT_NODE", id: geometry.id });
                  }}
                >
                  <NetworkGeometryNode
                    key={geometry.id}
                    geometryId={geometry.id}
                  />
                </div>
              ))}

              {/* Render Materials */}
              {state.context.materials.map((material) => (
                <div
                  key={material.id}
                  className={cn(
                    "absolute transition-all",
                    state.context.selectedNodeIds.find(
                      (id) => id === material.id,
                    ) && "ring-2 ring-blue-500",
                  )}
                  style={{
                    left: `${material.x}px`,
                    top: `${material.y}px`,
                  }}
                  onMouseEnter={() => setStopPropagation(true)}
                  onMouseLeave={() => setStopPropagation(false)}
                  onClick={(e) => {
                    e.stopPropagation();
                    machineRef.send({ type: "SELECT_NODE", id: material.id });
                  }}
                >
                  <NetworkMaterialNode
                    key={material.id}
                    materialId={material.id}
                  />
                </div>
              ))}

              {/* Render Textures */}
              {state.context.textures.map((texture) => (
                <div
                  key={texture.id}
                  className={cn(
                    "absolute transition-all",
                    state.context.selectedNodeIds.find(
                      (id) => id === texture.id,
                    ) && "ring-2 ring-blue-500",
                  )}
                  style={{
                    left: `${texture.x}px`,
                    top: `${texture.y}px`,
                  }}
                  onMouseEnter={() => setStopPropagation(true)}
                  onMouseLeave={() => setStopPropagation(false)}
                  onClick={(e) => {
                    e.stopPropagation();
                    machineRef.send({ type: "SELECT_NODE", id: texture.id });
                  }}
                >
                  <NetworkTextureNode
                    key={texture.id}
                    textureId={texture.id}
                    zoom={zoom}
                  />
                </div>
              ))}
            </div>

            <SelectionIndicator
              x={x}
              y={y}
              gridSize={gridSize}
              isActive={isPlacingAny}
            />
          </div>
        )}
      </Workspace>

      <PropertyInspector />

      <WebGLCanvas
        shadows
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: -1, // @important {zIndex: 1} allows the canvas to be rendered on top of the editor
        }}
      >
        <TextureRenderPipeline />
      </WebGLCanvas>
    </main>
  );
}
