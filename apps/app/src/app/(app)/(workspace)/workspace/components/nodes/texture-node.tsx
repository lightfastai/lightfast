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
import { getTextureInputsForType } from "@repo/webgl";
import { WebGLView } from "@repo/webgl/components";
import { GeometryMap } from "@repo/webgl/globals";
import { $GeometryType } from "@vendor/db/types";

import type { BaseNode } from "../../types/node";
import type { TextureInput } from "../../types/texture";
import { api } from "~/trpc/client/react";
import { useInspectorStore } from "../../providers/inspector-store-provider";
import { useTextureRenderStore } from "../../providers/texture-render-store-provider";

export const TextureNode = memo(
  ({ id, type, selected }: NodeProps<BaseNode>) => {
    const [data] = api.tenant.node.data.get.useSuspenseQuery<Texture>({ id });
    const { targets } = useTextureRenderStore((state) => state);
    const setSelected = useInspectorStore((state) => state.setSelected);

    // Get texture inputs metadata from the registry
    const textureInputs: TextureInput[] = getTextureInputsForType(data.type);

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
            "relative flex flex-col gap-2 p-2 text-card-foreground",
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
          <div className="flex flex-row items-center">
            <div className="flex h-full flex-col items-center justify-evenly gap-3 py-3">
              {textureInputs.length > 0 ? (
                // For nodes with inputs, create properly positioned handles
                textureInputs.map((input: TextureInput) => (
                  <div
                    key={input.id}
                    className="relative flex items-center justify-center"
                  >
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <Handle
                              id={input.id}
                              type="target"
                              position={Position.Left}
                              className={cn(
                                "h-3 w-3 rounded-full border transition-transform duration-150 hover:scale-125",
                                input.required
                                  ? "border-primary bg-primary"
                                  : "border-muted-foreground bg-muted",
                              )}
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          <span className="font-medium">
                            {input.description}
                          </span>
                          {!input.required && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              (optional)
                            </span>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                ))
              ) : (
                // No input handles for this texture type
                <></>
              )}
            </div>

            <div className="h-32 w-72 overflow-hidden rounded border">
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

            <div className="ml-1 flex items-center justify-center">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Handle
                        id="output"
                        type="source"
                        position={Position.Right}
                        className="h-3 w-3 rounded-full border border-primary bg-primary transition-transform duration-150 hover:scale-125"
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
