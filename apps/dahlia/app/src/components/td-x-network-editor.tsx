import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";

import { cn } from "@repo/ui/lib/utils";
import { createDefaultLimit, createDefaultPerlinNoise3D } from "@repo/webgl";

import { TDxMachineContext } from "~/app/(app)/(stable)/(network-editor)/state/context";
import {
  DEFAULT_MATERIAL_COLOR,
  DEFAULT_POSITION,
  DEFAULT_ROTATION,
  DEFAULT_SCALE,
} from "./constants";
import { createPath } from "./path-utils";
import { SelectionIndicator } from "./selection-indicator";
import { NetworkGeometryNode } from "./td-x-network-editor-geometry-node";
import { NetworkMaterialNode } from "./td-x-network-editor-material-node";
import { NetworkTextureNode } from "./td-x-network-editor-texture-node";
import { TextureRenderPipeline } from "./texture/texture-render-pipeline";
import { ZoomPanPinchCanvas } from "./zoom-pan-pinch-canvas";

export const TDxNetworkEditor = () => {
  const state = TDxMachineContext.useSelector((state) => state);
  const machineRef = TDxMachineContext.useActorRef();

  const handleGeometryCreate = (x: number, y: number) => {
    if (!state.context.selectedGeometry) return;

    machineRef.send({
      type: "ADD_GEOMETRY",
      geometry: {
        id: Date.now(),
        type: state.context.selectedGeometry,
        position: DEFAULT_POSITION,
        scale: DEFAULT_SCALE,
        rotation: DEFAULT_ROTATION,
        inputPos: {
          x: x,
          y: y,
        },
        outputPos: {
          x: x,
          y: y,
        },
        x,
        y,
        wireframe: false,
        material: null,
        shouldRenderInNode: true,
      },
    });
  };

  const handleMaterialCreate = (x: number, y: number) => {
    if (!state.context.selectedMaterial) return;
    machineRef.send({
      type: "ADD_MATERIAL",
      material: {
        id: Date.now(),
        inputPos: {
          x: x,
          y: y,
        },
        outputPos: {
          x: x,
          y: y,
        },
        type: state.context.selectedMaterial,
        color: DEFAULT_MATERIAL_COLOR,
        x,
        y,
        shouldRenderInNode: true,
      },
    });
  };

  const handleTextureCreate = (x: number, y: number) => {
    if (!state.context.selectedTexture) return;

    if (state.context.selectedTexture === "Noise") {
      machineRef.send({
        type: "ADD_TEXTURE",
        texture: {
          id: Date.now(), // @todo: Fix this back to Date
          x,
          inputPos: {
            x: x,
            y: y,
          },
          outputPos: {
            x: x,
            y: y,
          },
          y,
          shouldRenderInNode: true,
          type: "Noise",
          uniforms: createDefaultPerlinNoise3D(),
          input: null,
          outputs: [],
        },
      });
    }

    if (state.context.selectedTexture === "Limit") {
      machineRef.send({
        type: "ADD_TEXTURE",
        texture: {
          id: Date.now(),
          x,
          y,
          inputPos: {
            x: x,
            y: y,
          },
          outputPos: {
            x: x,
            y: y,
          },
          shouldRenderInNode: true,
          type: "Limit",
          uniforms: createDefaultLimit(),
          input: null,
          outputs: [],
        },
      });
    }
  };

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
    <>
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
      <ZoomPanPinchCanvas debug>
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
      </ZoomPanPinchCanvas>
    </>
  );
};
