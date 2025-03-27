import type { NodeProps } from "@xyflow/react";
import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { ArrowRightIcon } from "lucide-react";

import type { Texture } from "@dahlia/db/tenant/schema";
import { $GeometryType } from "@dahlia/db/tenant/schema";
import { BaseNodeComponent } from "@repo/ui/components/base-node";
import { Label } from "@repo/ui/components/ui/label";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/ui/components/ui/toggle-group";
import { cn } from "@repo/ui/lib/utils";

import type { BaseNode } from "../../types/node";
import { api } from "~/trpc/client/react";
import { useInspectorStore } from "../../providers/inspector-store-provider";
import { useTextureRenderStore } from "../../providers/texture-render-store-provider";
import { GeometryMap } from "../webgl/webgl-globals";
import { WebGLView } from "../webgl/webgl-primitives";

export const TextureNode = memo(
  ({ id, type, selected, isConnectable }: NodeProps<BaseNode>) => {
    const [data] = api.tenant.node.data.get.useSuspenseQuery<Texture>({ id });
    const { targets } = useTextureRenderStore((state) => state);
    const setSelected = useInspectorStore((state) => state.setSelected);
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
            `relative cursor-pointer flex-col gap-1 border p-1 text-card-foreground shadow-sm`,
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
                size="xs"
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
            <div className="flex items-center justify-center">
              <Handle
                type="target"
                position={Position.Left}
                className="h-10 w-3"
              />
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
                  <mesh geometry={GeometryMap[$GeometryType.Enum.plane]}>
                    <meshBasicMaterial map={targets[id].texture} />
                  </mesh>
                </WebGLView>
              )}
            </div>

            <div className="flex items-center justify-center">
              <Handle
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
