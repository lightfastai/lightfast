import { memo, useEffect } from "react";
import { NodeProps } from "@xyflow/react";
import { ArrowRightIcon } from "lucide-react";

import { Texture } from "@repo/db/schema";
import { BaseNodeComponent } from "@repo/ui/components/base-node";
import { Label } from "@repo/ui/components/ui/label";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/ui/components/ui/toggle-group";
import { cn } from "@repo/ui/lib/utils";

import { api } from "~/trpc/react";
import { useTextureRenderStore } from "../../providers/texture-render-store-provider";
import { BaseNode } from "../../types/node";
import { WebGLView } from "../webgl/webgl-primitives";

export const TextureNode = memo(
  ({ id, type, selected }: NodeProps<BaseNode>) => {
    const [data] = api.node.data.get.useSuspenseQuery<Texture>({ id });
    const { targets, addTexture } = useTextureRenderStore((state) => state);
    useEffect(() => {
      addTexture(id);
    }, [id]);
    return (
      <BaseNodeComponent id={id} selected={selected}>
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
            <div className="flex items-center justify-center border">
              {/* <Button
                ref={inputButtonRef}
                className={cn(
                  "h-10 w-3 border-b border-t px-0 py-0",
                  texture.input && "ring-1 ring-muted-foreground",
                )}
                variant="ghost"
              /> */}
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
                  <mesh>
                    <planeGeometry args={[4, 4]} />
                    <meshBasicMaterial map={targets[id].texture} />
                  </mesh>
                </WebGLView>
              )}
            </div>

            <div className="flex items-center justify-center border">
              {/* <Button
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
              /> */}
            </div>
          </div>
        </div>
      </BaseNodeComponent>
    );
  },
);
