import type { NodeProps } from "@xyflow/react";
import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { ArrowRightIcon } from "lucide-react";

import { BaseNodeComponent } from "@repo/ui/components/base-node";
import { Label } from "@repo/ui/components/ui/label";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/ui/components/ui/toggle-group";
import { cn } from "@repo/ui/lib/utils";

import type { BaseNode } from "../../types/node";
import type { Texture } from "~/db/schema/types";
import { $GeometryType, $TextureTypes } from "~/db/schema/types";
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
    return inputIndex === 0 ? "src" : "map";
  } else if (textureType === $TextureTypes.enum.Add) {
    return inputIndex === 0 ? "A" : "B";
  }
  return `in${inputIndex + 1}`;
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
            `relative cursor-pointer flex-col gap-1 p-1 text-card-foreground shadow-sm`,
          )}
        >
          <div className="flex flex-row items-center justify-between">
            <Label className="font-mono text-xs font-bold uppercase tracking-widest">
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
                          ? "mb-auto mt-2"
                          : isLast
                            ? "mb-2 mt-auto"
                            : "my-auto",
                      )}
                    >
                      <Handle
                        id={`input-${index + 1}`}
                        type="target"
                        position={Position.Left}
                        className="h-10 w-3"
                        style={{ top: `${topPercentage}%` }}
                      />
                      <div className="ml-1 text-xs">
                        {getInputLabel(data.type, index)}
                      </div>
                    </div>
                  );
                })
              ) : (
                // For nodes with a single input, center it
                <Handle
                  id="input-1"
                  type="target"
                  position={Position.Left}
                  className="h-10 w-3"
                />
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
              <Handle
                id="output"
                type="source"
                position={Position.Right}
                className="h-10 w-3"
              />
            </div>
          </div>
        </div>
      </BaseNodeComponent>
    );
  },
);
