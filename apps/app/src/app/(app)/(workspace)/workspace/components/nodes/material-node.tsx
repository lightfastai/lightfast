import type { NodeProps } from "@xyflow/react";
import { memo } from "react";
import { ArrowRightIcon } from "lucide-react";

import type { Material } from "@vendor/db/types";
import { GeometryRenderer } from "@repo/threejs";
import { BaseNodeComponent } from "@repo/ui/components/base-node";
import { Label } from "@repo/ui/components/ui/label";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/ui/components/ui/toggle-group";
import { cn } from "@repo/ui/lib/utils";

import type { BaseNode } from "../../types/node";
import { api } from "~/trpc/client/react";
import { WebGLViewContext } from "../webgl/webgl-view-context";

export const MaterialNode = memo(
  ({ id, type, selected }: NodeProps<BaseNode>) => {
    const [data] = api.tenant.node.data.get.useSuspenseQuery<Material>({
      nodeId: id,
    });
    return (
      <BaseNodeComponent selected={selected}>
        <div
          key={id}
          className={cn(
            "flex cursor-pointer flex-col gap-y-1 p-1 text-card-foreground shadow-sm",
          )}
        >
          <div className="flex flex-row items-center justify-between">
            <Label className="font-mono text-xs font-bold uppercase tracking-widest">
              {type} {id}
            </Label>
            <ToggleGroup type="single">
              <ToggleGroupItem value="renderInNode" variant="outline" size="sm">
                <ArrowRightIcon className="h-3 w-3" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="flex h-32 w-72 items-center justify-center border">
            <WebGLViewContext>
              <GeometryRenderer
                type={"torus"}
                wireframe={false}
                animate={true}
              />
            </WebGLViewContext>
          </div>
        </div>
      </BaseNodeComponent>
    );
  },
);
