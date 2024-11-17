import { useLayoutEffect, useRef, useState } from "react";
import { View } from "@react-three/drei";
import { ArrowRightIcon, TrashIcon } from "lucide-react";

import { Button } from "@repo/ui/components/ui/button";
import { Label } from "@repo/ui/components/ui/label";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/ui/components/ui/toggle-group";
import { cn } from "@repo/ui/lib/utils";

import type { Texture } from "../app/(app)/(stable)/(network-editor)/types/texture";
import { NetworkEditorContext } from "~/app/(app)/(stable)/(network-editor)/state/context";

export const NetworkTextureNode = ({
  textureId,
  zoom,
}: {
  textureId: number;
  zoom: number;
}) => {
  const texture = NetworkEditorContext.useSelector((state) =>
    state.context.textures.find((m) => m.id === textureId),
  );
  const machineRef = NetworkEditorContext.useActorRef();
  const [isHovered, setIsHovered] = useState(false);
  const outputButtonRef = useRef<HTMLButtonElement>(null);
  const inputButtonRef = useRef<HTMLButtonElement>(null);
  const rtarget = NetworkEditorContext.useSelector(
    (state) => state.context.rtargets[textureId],
  );
  const activeConnection = NetworkEditorContext.useSelector(
    (state) => state.context.activeConnection,
  );

  const isConnectionTarget =
    isHovered && activeConnection && activeConnection.sourceId !== textureId;

  // Geometry Drag Handlers
  const handleMaterialClick = (texture: Texture) => {
    machineRef.send({ type: "UPDATE_SELECTED_PROPERTY", property: texture });
  };

  useLayoutEffect(() => {
    const updateConnectionPoints = () => {
      if (!outputButtonRef.current || !inputButtonRef.current) return;

      const outputRect = outputButtonRef.current.getBoundingClientRect();
      const inputRect = inputButtonRef.current.getBoundingClientRect();
      const canvas = outputButtonRef.current.closest('[data-canvas="true"]');
      if (!canvas) return;

      const canvasRect = canvas.getBoundingClientRect();
      const scrollLeft = canvas.scrollLeft || 0;
      const scrollTop = canvas.scrollTop || 0;

      // Calculate center points of the buttons
      const outputPos = {
        x:
          (outputRect.left -
            canvasRect.left +
            scrollLeft +
            outputRect.width / 2) /
          zoom,
        y:
          (outputRect.top -
            canvasRect.top +
            scrollTop +
            outputRect.height / 2) /
          zoom,
      };

      const inputPos = {
        x:
          (inputRect.left -
            canvasRect.left +
            scrollLeft +
            inputRect.width / 2) /
          zoom,
        y:
          (inputRect.top - canvasRect.top + scrollTop + inputRect.height / 2) /
          zoom,
      };

      machineRef.send({
        type: "UPDATE_TEXTURE",
        textureId,
        value: {
          outputPos,
          inputPos,
        },
      });
    };

    // Initial update
    updateConnectionPoints();

    // Setup observer for size/position changes
    const resizeObserver = new ResizeObserver(updateConnectionPoints);
    const elements = [outputButtonRef.current, inputButtonRef.current].filter(
      Boolean,
    );

    elements.forEach((el) => el && resizeObserver.observe(el));

    // Add scroll listener to update on scroll
    const canvas = outputButtonRef.current?.closest('[data-canvas="true"]');
    if (canvas) {
      canvas.addEventListener("scroll", updateConnectionPoints);
    }

    return () => {
      resizeObserver.disconnect();
      if (canvas) {
        canvas.removeEventListener("scroll", updateConnectionPoints);
      }
    };
  }, [texture?.x, texture?.y, machineRef, textureId, zoom]);

  if (!texture) return null;

  return (
    <>
      <div
        key={texture.id}
        className={cn(
          `cursor-pointer flex-col gap-1 border p-1 text-card-foreground shadow-sm`,
          isConnectionTarget && "ring-2 ring-primary",
        )}
        onClick={() => {
          if (!activeConnection) {
            handleMaterialClick(texture);
          }
        }}
        onMouseUp={() => {
          if (
            activeConnection &&
            isHovered &&
            activeConnection.sourceId !== textureId
          ) {
            machineRef.send({ type: "END_CONNECTION", targetId: textureId });
          }
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex flex-row items-center justify-between">
          <Label className="font-mono text-xs font-bold uppercase tracking-widest">
            {texture.type}
          </Label>
          <ToggleGroup type="single">
            <ToggleGroupItem
              value="renderInNode"
              variant="outline"
              size="xs"
              onClick={() => {
                machineRef.send({
                  type: "UPDATE_TEXTURE",
                  textureId: texture.id,
                  value: {
                    shouldRenderInNode: !texture.shouldRenderInNode,
                  },
                });
              }}
            >
              <ArrowRightIcon className="h-3 w-3" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="deleteTexture"
              variant="outline"
              size="xs"
              onClick={() => {
                machineRef.send({
                  type: "DELETE_TEXTURE",
                  textureId: texture.id,
                });
              }}
            >
              <TrashIcon className="h-3 w-3" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="mt-1 flex flex-row gap-1">
          <div className="flex items-center justify-center border">
            <Button
              ref={inputButtonRef}
              className={cn(
                "h-10 w-3 border-b border-t px-0 py-0",
                texture.input && "ring-1 ring-muted-foreground",
              )}
              variant="ghost"
            />
          </div>

          <div className="h-32 w-72 border">
            {texture.shouldRenderInNode && rtarget && (
              <View
                style={{
                  position: "relative",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  zIndex: 1000,
                }}
              >
                <color attach="background" args={["black"]} />
                <mesh>
                  <planeGeometry args={[4, 4]} />
                  <meshBasicMaterial map={rtarget.texture} />
                </mesh>
              </View>
            )}
          </div>

          <div className="flex items-center justify-center border">
            <Button
              ref={outputButtonRef}
              className="h-10 w-3 border-b border-t px-0 py-0"
              variant="ghost"
              onMouseDown={(e) => {
                e.stopPropagation();
                machineRef.send({
                  type: "START_CONNECTION",
                  sourceId: textureId,
                });
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
};
