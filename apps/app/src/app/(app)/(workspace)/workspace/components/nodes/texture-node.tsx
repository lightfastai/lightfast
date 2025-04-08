import type { NodeProps } from "@xyflow/react";
import { memo } from "react";
import { Position } from "@xyflow/react";
import { ArrowRightIcon } from "lucide-react";

import type { Texture } from "@vendor/db/types";
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
  createOutputHandleId,
  createTextureHandleId,
} from "@vendor/db/types";

import type { BaseNode } from "../../types/node";
import type { TextureInput } from "../../types/texture";
import { api } from "~/trpc/client/react";
import { useInspectorStore } from "../../providers/inspector-store-provider";
import { useTextureRenderStore } from "../../providers/texture-render-store-provider";
import { NodeHandle } from "../common/node-handle";

export const TextureNode = memo(
  ({ id, type, selected }: NodeProps<BaseNode>) => {
    const [data] = api.tenant.node.data.get.useSuspenseQuery<Texture>({ id });
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

            <div className="absolute left-0 top-0 flex h-full flex-col items-center justify-evenly gap-3 py-3">
              {textureInputs.length > 0 ? (
                // For nodes with inputs, create properly positioned handles
                textureInputs.map((input: TextureInput) => {
                  const handleId = createTextureHandleId(input.handle.handleId);
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
