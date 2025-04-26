import type { NodeProps } from "@xyflow/react";
import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { ArrowRightIcon } from "lucide-react";

import type { Texture } from "@vendor/db/types";
import { BaseNodeComponent } from "@repo/ui/components/base-node";
import { Label } from "@repo/ui/components/ui/label";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/ui/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { cn } from "@repo/ui/lib/utils";
import { $GeometryType, $TextureTypes } from "@vendor/db/types";

import type { BaseNode } from "../../types/node";
import { api } from "~/trpc/client/react";
import { useInspectorStore } from "../../providers/inspector-store-provider";
import { useTextureRenderStore } from "../../providers/texture-render-store-provider";
import { GeometryMap } from "../webgl/webgl-globals";
import { WebGLView } from "../webgl/webgl-primitives";

// Get number of inputs needed for each texture type
const getTextureInputs = (textureType: string): number => {
  switch (textureType) {
    case $TextureTypes.enum.Displace:
    case $TextureTypes.enum.Add:
      return 2;
    default:
      return 1;
  }
};

// Get input labels for each texture type and position
const getInputLabel = (textureType: string, inputIndex: number): string => {
  if (textureType === $TextureTypes.enum.Displace) {
    return inputIndex === 0 ? "Source Image" : "Displacement Map";
  } else if (textureType === $TextureTypes.enum.Add) {
    return inputIndex === 0 ? "Input A" : "Input B";
  }
  return `Input ${inputIndex + 1}`;
};

export const TextureNode = memo(
  ({ id, type, selected }: NodeProps<BaseNode>) => {
    const [data] = api.tenant.node.data.get.useSuspenseQuery<Texture>({ id });
    const { targets } = useTextureRenderStore((state) => state);
    const setSelected = useInspectorStore((state) => state.setSelected);

    // Determine how many inputs this texture node needs
    const inputCount = getTextureInputs(data.type);

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
            `text-card-foreground relative cursor-pointer flex-col gap-1 p-1 shadow-sm`,
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
                    geometry={GeometryMap[$GeometryType.Enum.plane]}
                    scale={3}
                  >
                    <meshBasicMaterial map={targets[id].texture} />
                  </mesh>
                </WebGLView>
              )}
            </div>

            <div className="flex items-center justify-center">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Handle
                        id="output"
                        type="source"
                        position={Position.Right}
                        className="h-10 w-3"
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">Output</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
      </BaseNodeComponent>
    );
  },
);
