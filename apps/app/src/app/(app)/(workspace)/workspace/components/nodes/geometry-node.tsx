import type { NodeProps } from "@xyflow/react";
import { memo } from "react";
import { ArrowRightIcon } from "lucide-react";
import * as THREE from "three";

import type { Geometry } from "@vendor/db/lightfast/types";
import { GeometryRenderer } from "@repo/threejs";
import { BaseNodeComponent } from "@repo/ui/components/base-node";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Label } from "@repo/ui/components/ui/label";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/ui/components/ui/toggle-group";
import { cn } from "@repo/ui/lib/utils";

import type { BaseNode } from "../../types/node";
import { api } from "~/trpc/client/react";
import { WebGLViewContext } from "../webgl/webgl-view-context";

export const GeometryNode = memo(
  ({ id, type, selected }: NodeProps<BaseNode>) => {
    const [data] = api.tenant.node.data.get.useSuspenseQuery<Geometry>({
      nodeId: id,
    });
    return (
      <BaseNodeComponent selected={selected}>
        <div
          className={cn(
            "text-card-foreground flex cursor-pointer flex-col gap-y-1 p-1 shadow-sm",
          )}
        >
          <div className="flex flex-row items-center justify-between">
            <Label className="font-mono text-xs font-bold tracking-widest uppercase">
              {type} {id}
            </Label>
            <ToggleGroup type="single">
              <ToggleGroupItem
                value="renderInNode"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  // if (!data) return;
                }}
              >
                <ArrowRightIcon className="h-3 w-3" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="flex h-32 w-72 items-center justify-center border">
            <WebGLViewContext>
              <GeometryRenderer
                type={data.type}
                position={
                  new THREE.Vector3(
                    Number(data.position.x),
                    Number(data.position.y),
                    Number(data.position.z),
                  )
                }
                rotation={
                  new THREE.Vector3(
                    Number(data.rotation.x),
                    Number(data.rotation.y),
                    Number(data.rotation.z),
                  )
                }
                animate={true}
              />
            </WebGLViewContext>
          </div>

          <div className="flex items-center justify-end">
            <Checkbox
              id={`wireframe-${id}`}
              checked={data.wireframe}
              // onCheckedChange={() => {}}
            />
          </div>
        </div>
      </BaseNodeComponent>
    );
  },
);
