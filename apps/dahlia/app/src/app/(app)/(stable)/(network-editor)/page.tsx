"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";

import { cn } from "@repo/ui/lib/utils";

import { Workspace } from "~/app/(app)/(stable)/(network-editor)/components/workspace/workspace";
import { createPath } from "~/components/path-utils";
import { SelectionIndicator } from "~/components/selection-indicator";
import { NetworkGeometryNode } from "~/components/td-x-network-editor-geometry-node";
import { NetworkMaterialNode } from "~/components/td-x-network-editor-material-node";
import { NetworkTextureNode } from "~/components/td-x-network-editor-texture-node";
import { TextureRenderPipeline } from "~/components/texture/texture-render-pipeline";
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
      <Canvas
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
      </Canvas>
      <Workspace debug>
        {({ cursorPosition: { x, y }, gridSize, setStopPropagation, zoom }) => (
          <div
            className={cn("h-full w-full")}
            onMouseUp={() => {
              if (state.context.activeConnection) {
                machineRef.send({ type: "CANCEL_CONNECTION" });
              }
            }}
            onClick={() => {
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

            {/* Render Geometries, Materials, and Textures with higher z-index */}
            <div style={{ position: "relative", zIndex: 1 }}>
              {/* Render Geometries */}
              {state.context.geometries.map((geometry) => (
                <div
                  key={geometry.id}
                  className="absolute"
                  style={{
                    left: `${geometry.x}px`,
                    top: `${geometry.y}px`,
                  }}
                  onMouseEnter={() => setStopPropagation(true)}
                  onMouseLeave={() => setStopPropagation(false)}
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
                  className="absolute"
                  style={{
                    left: `${material.x}px`,
                    top: `${material.y}px`,
                  }}
                  onMouseEnter={() => setStopPropagation(true)}
                  onMouseLeave={() => setStopPropagation(false)}
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
                  className="absolute"
                  style={{
                    left: `${texture.x}px`,
                    top: `${texture.y}px`,
                  }}
                  onMouseEnter={() => setStopPropagation(true)}
                  onMouseLeave={() => setStopPropagation(false)}
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
    </main>
  );
}
