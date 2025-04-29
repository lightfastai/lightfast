"use client";

import type { NodeProps } from "@xyflow/react";
import { memo } from "react";
import { Position } from "@xyflow/react";
import { ArrowRightIcon } from "lucide-react";

import type { Sampler2DMetadata } from "@repo/webgl";
import type { Texture } from "@vendor/db/lightfast/types";
import { GeometryMap, WebGLView } from "@repo/threejs";
import { BaseNodeComponent } from "@repo/ui/components/base-node";
import { Label } from "@repo/ui/components/ui/label";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/ui/components/ui/toggle-group";
import { cn } from "@repo/ui/lib/utils";
import { getShaderSampler2DInputsForType } from "@repo/webgl";
import {
  $GeometryType,
  createInputHandleId,
  createOutputHandleId,
} from "@vendor/db/lightfast/types";

import type { BaseNode } from "../../types/node";
import { api } from "~/trpc/client/react";
import { useInspectorStore } from "../../providers/inspector-store-provider";
import { useTextureRenderStore } from "../../providers/texture-render-store-provider";
import { NodeHandle } from "../common/node-handle";

export const TextureNode = memo(
  ({ id, type, selected }: NodeProps<BaseNode>) => {
    const [data] = api.tenant.node.data.get.useSuspenseQuery<Texture>({
      nodeId: id,
    });
    const { targets } = useTextureRenderStore((state) => state);
    const setSelected = useInspectorStore((state) => state.setSelected);

    // Get texture inputs metadata from the registry
    const textureInputs = getShaderSampler2DInputsForType(data.type);

    // Create branded handle IDs
    const outputHandle = createOutputHandleId("output-1");
    if (!outputHandle) {
      throw new Error("Failed to create output handle");
    }

    return (
      <BaseNodeComponent
        id={id}
        selected={selected}
        onClick={() => {
          setSelected({ id, type });
        }}
      >
        <div
          key={id}
          className={cn(
<<<<<<< HEAD
            `text-card-foreground relative cursor-pointer flex-col gap-1 p-1 shadow-sm`,
=======
            "relative flex flex-col gap-2 p-2 text-card-foreground",
>>>>>>> staging
          )}
        >
          <div className="flex flex-row items-center justify-between">
            <Label className="font-mono text-xs font-bold tracking-widest uppercase">
              {data.type} {id}
            </Label>
            <ToggleGroup type="single">
              <ToggleGroupItem
                value="renderInNode"
                variant="outline"
                size="sm"
                onClick={() => {
                  // machineRef.send({
                  //   type: "UPDATE_TEXTURE",
                  //   textureId: data.id,
                  //   value: {
                  //     shouldRenderInNode: !data.shouldRenderInNode,
                  //   },
                  // });
                }}
              >
                <ArrowRightIcon className="h-3 w-3" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
<<<<<<< HEAD
          <div className="mt-1 flex flex-row gap-1">
            <div className="flex h-full flex-col items-center justify-center">
              {inputCount > 1 ? (
                // For nodes with multiple inputs, create spaced handles
                Array.from({ length: inputCount }).map((_, index) => {
                  const topPercentage = (index / (inputCount - 1)) * 100;
                  const isFirst = index === 0;
                  const isLast = index === inputCount - 1;

                  return (
                    <div
                      key={`input-${index}`}
                      className={cn(
                        isFirst
                          ? "mt-2 mb-auto"
                          : isLast
                            ? "mt-auto mb-2"
                            : "my-auto",
                      )}
                    >
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div>
                              <Handle
                                id={`input-${index + 1}`}
                                type="target"
                                position={Position.Left}
                                className="h-10 w-3"
                                style={{ top: `${topPercentage}%` }}
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            {getInputLabel(data.type, index)}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  );
                })
              ) : (
                // For nodes with a single input, center it
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Handle
                          id="input-1"
                          type="target"
                          position={Position.Left}
                          className="h-10 w-3"
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      {getInputLabel(data.type, 0)}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            <div className="h-32 w-72 border">
=======
          <div className="flex flex-row items-center">
            <div className="h-32 w-72 overflow-hidden rounded border">
>>>>>>> staging
              {targets[id]?.texture && (
                <WebGLView
                  style={{
                    position: "relative",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                  }}
                >
                  <mesh
                    geometry={GeometryMap[$GeometryType.enum.plane]}
                    scale={3}
                  >
                    <meshBasicMaterial map={targets[id].texture} />
                  </mesh>
                </WebGLView>
              )}
            </div>

            <div className="absolute left-0 top-0 flex h-full flex-col items-center justify-evenly gap-3 py-3">
              {textureInputs.length > 0 ? (
                // For nodes with inputs, create properly positioned handles
                textureInputs.map((input: Sampler2DMetadata) => {
                  const handleId = createInputHandleId(input.handle.handleId);
                  return (
                    <div
                      key={input.handle.handleId}
                      className="relative flex items-center justify-center py-1"
                    >
                      <NodeHandle
                        id={handleId}
                        position={Position.Left}
                        tooltipSide="left"
                        description={input.handle.description}
                      />
                    </div>
                  );
                })
              ) : (
                // No input handles for this texture type
                <></>
              )}
            </div>

            <div className="absolute right-0 top-0 flex h-full items-center justify-center">
              <NodeHandle
                id={outputHandle}
                position={Position.Right}
                description={"Output"}
                tooltipSide="right"
              />
            </div>
          </div>
        </div>
      </BaseNodeComponent>
    );
  },
);
