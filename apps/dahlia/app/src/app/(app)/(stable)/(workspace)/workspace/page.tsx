"use client";

import { useCallback, useEffect, useMemo } from "react";

import { cn } from "@repo/ui/lib/utils";

import { SelectionIndicator } from "~/app/(app)/(stable)/(workspace)/workspace/components/workspace/selection-indicator";
import { NetworkGeometryNode } from "~/components/td-x-network-editor-geometry-node";
import { NetworkMaterialNode } from "~/components/td-x-network-editor-material-node";
import { NetworkTextureNode } from "~/components/td-x-network-editor-texture-node";
import { PropertyInspector } from "./components/inspector/property-inspector";
import { TextureRenderPipeline } from "./components/webgl/texture-render-pipeline";
import { WebGLCanvas } from "./components/webgl/webgl-canvas";
import { Workspace } from "./components/workspace/workspace";
import { useCreateGeometry } from "./hooks/use-create-geometry";
import { useCreateMaterial } from "./hooks/use-create-material";
import { useCreateTexture } from "./hooks/use-create-texture";
import { useDeleteSelected } from "./hooks/use-delete-selected";
import { NetworkEditorContext } from "./state/context";

export default function Page() {
  const state = NetworkEditorContext.useSelector((state) => state);
  const machineRef = NetworkEditorContext.useActorRef();

  const { handleGeometryCreate } = useCreateGeometry();
  const { handleMaterialCreate } = useCreateMaterial();
  const { handleTextureCreate } = useCreateTexture();
  const { handleDeleteSelectedNodes } = useDeleteSelected();

  const isNodeInSelection = useCallback(
    (
      nodeX: number,
      nodeY: number,
      zoom: number,
      start: { x: number; y: number },
      end: { x: number; y: number },
    ) => {
      const NODE_WIDTH = 200 * zoom;
      const NODE_HEIGHT = 100 * zoom;

      const selectionLeft = Math.min(start.x, end.x) / zoom;
      const selectionRight = Math.max(start.x, end.x) / zoom;
      const selectionTop = Math.min(start.y, end.y) / zoom;
      const selectionBottom = Math.max(start.y, end.y) / zoom;

      const nodeLeft = nodeX;
      const nodeRight = nodeX + NODE_WIDTH;
      const nodeTop = nodeY;
      const nodeBottom = nodeY + NODE_HEIGHT;

      return !(
        nodeLeft > selectionRight ||
        nodeRight < selectionLeft ||
        nodeTop > selectionBottom ||
        nodeBottom < selectionTop
      );
    },
    [],
  );

  const handleSelect = useCallback(
    (
      start: { x: number; y: number },
      end: { x: number; y: number },
      zoom: number,
    ) => {
      const selectedNodes = [
        ...state.context.geometries,
        ...state.context.materials,
        ...state.context.textures,
      ].filter((node) => isNodeInSelection(node.x, node.y, zoom, start, end));

      if (selectedNodes.length > 0) {
        machineRef.send({
          type: "SELECT_NODES",
          ids: selectedNodes.map((node) => node.id),
        });
      } else {
        machineRef.send({ type: "DESELECT_ALL" });
      }
    },
    [
      state.context.geometries,
      state.context.materials,
      state.context.textures,
      machineRef,
      isNodeInSelection,
    ],
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

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (state.context.selectedNodeIds.length > 0) {
          handleDeleteSelectedNodes();
        }
      }
    },
    [handleDeleteSelectedNodes],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Prepare connections data
  const connections = useMemo(() => {
    return state.context.textures
      .flatMap((texture) =>
        texture.outputs.map((targetId) => {
          const targetNode = state.context.textures.find(
            (t) => t.id === targetId,
          );
          if (!targetNode) return null;

          return {
            sourceId: String(texture.id),
            sourcePos: texture.outputPos,
            targetId: String(targetNode.id),
            targetPos: targetNode.inputPos,
          };
        }),
      )
      .filter(
        (connection): connection is NonNullable<typeof connection> =>
          connection !== null,
      );
  }, [state.context.textures]);

  // Prepare connection in progress data
  const connectionInProgress = useMemo(() => {
    if (!state.context.activeConnection) return undefined;

    const sourceTexture = state.context.textures.find(
      (t) => t.id === state.context.activeConnection?.sourceId,
    );

    if (!sourceTexture) return undefined;

    return {
      sourceId: String(sourceTexture.id),
      sourcePos: sourceTexture.outputPos,
    };
  }, [state.context.activeConnection, state.context.textures]);

  return (
    <main className="relative flex-1 overflow-hidden">
      <Workspace
        debug
        onSelect={handleSelect}
        connections={connections}
        connectionInProgress={connectionInProgress}
      >
        {({ cursorPosition: { x, y }, gridSize, renderNode, zoom }) => (
          <div
            className={cn("h-full w-full")}
            onClick={(e) => {
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
            {/* Render Geometries, Materials, and Textures with higher z-index */}
            <div style={{ position: "relative", zIndex: 1 }}>
              {/* Render Geometries */}
              {state.context.geometries.map((geometry) =>
                renderNode({
                  id: geometry.id,
                  x: geometry.x,
                  y: geometry.y,
                  isSelected: state.context.selectedNodeIds.includes(
                    geometry.id,
                  ),
                  children: <NetworkGeometryNode geometryId={geometry.id} />,
                }),
              )}

              {/* Render Materials */}
              {state.context.materials.map((material) =>
                renderNode({
                  id: material.id,
                  x: material.x,
                  y: material.y,
                  isSelected: state.context.selectedNodeIds.includes(
                    material.id,
                  ),
                  children: <NetworkMaterialNode materialId={material.id} />,
                }),
              )}

              {/* Render Textures */}
              {state.context.textures.map((texture) =>
                renderNode({
                  id: texture.id,
                  x: texture.x,
                  y: texture.y,
                  isSelected: state.context.selectedNodeIds.includes(
                    texture.id,
                  ),
                  onClick: (e) => {
                    e.stopPropagation();
                    machineRef.send({
                      type: "UPDATE_SELECTED_PROPERTY",
                      property: texture,
                    });
                  },
                  children: (
                    <NetworkTextureNode textureId={texture.id} zoom={zoom} />
                  ),
                }),
              )}
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
          zIndex: -1,
        }}
      >
        <TextureRenderPipeline />
      </WebGLCanvas>
    </main>
  );
}
