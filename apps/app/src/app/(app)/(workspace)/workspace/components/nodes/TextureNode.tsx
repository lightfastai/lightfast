import type { NodeProps } from "@xyflow/react";
import { memo } from "react";
import { Position } from "@xyflow/react";
import { ArrowRightIcon } from "lucide-react";

import type { Texture } from "@vendor/db/types";
import { BaseNodeComponent } from "@repo/ui/components/base-node";
import { Label } from "@repo/ui/components/ui/label";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/ui/components/ui/toggle-group";
import { cn } from "@repo/ui/lib/utils";
import { getShaderSampler2DInputsForType, textureRegistry } from "@repo/webgl";
import { WebGLView } from "@repo/webgl/components";
import { GeometryMap } from "@repo/webgl/globals";
import {
  $GeometryType,
  createOutputHandleId,
  createTextureHandleId,
} from "@vendor/db/types";

import type { TextureRenderStore } from "../../stores/texture-render-store";
import type { BaseNode } from "../../types/node";
import { api } from "~/trpc/client/react";
import { useUpdateTexture } from "../../hooks/use-update-texture";
import { useInspectorStore } from "../../providers/inspector-store-provider";
import { useTextureRenderStore } from "../../providers/texture-render-store-provider";
import { NodeHandle } from "../common/node-handle";

export const TextureNode = memo(
  ({ id, type, selected }: NodeProps<BaseNode>) => {
    const [data] = api.tenant.node.data.get.useSuspenseQuery<Texture>({ id });
    const { targets } = useTextureRenderStore((state: TextureRenderStore) => ({
      targets: state.targets,
    }));
    const setSelected = useInspectorStore((state) => state.setSelected);
    const { updateTextureUniforms } = useUpdateTexture(type);

    // Get texture configuration from registry
    const config = textureRegistry[type];
    if (!config) {
      console.warn(`No configuration found for texture type: ${type}`);
      return null;
    }

    // Get texture inputs metadata
    const textureInputs = getShaderSampler2DInputsForType(type);

    // Create output handle
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
              <ToggleGroupItem value="renderInNode" variant="outline" size="sm">
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
              {textureInputs.map((input) => {
                const handleId = createTextureHandleId(input.handle.id);
                if (!handleId) {
                  throw new Error(`Invalid handle ID: ${input.handle.id}`);
                }
                return (
                  <div
                    key={input.handle.id}
                    className="relative flex items-center justify-center py-1"
                  >
                    <NodeHandle
                      id={handleId}
                      position={Position.Left}
                      description={input.description}
                      isRequired={input.required}
                      tooltipSide="left"
                    />
                  </div>
                );
              })}
            </div>

            <div className="absolute right-0 top-0 flex h-full items-center justify-center">
              <NodeHandle
                id={outputHandle}
                position={Position.Right}
                description="Output"
                isRequired={true}
                tooltipSide="right"
              />
            </div>
          </div>
        </div>
      </BaseNodeComponent>
    );
  },
);
