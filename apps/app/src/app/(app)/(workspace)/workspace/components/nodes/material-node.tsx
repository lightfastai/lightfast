import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { ArrowRightIcon } from "lucide-react";

import type { Material } from "@dahlia/db/tenant/schema";
import { createDefaultGeometry } from "@dahlia/db/tenant/schema";
import { BaseNodeComponent } from "@repo/ui/components/base-node";
import { Label } from "@repo/ui/components/ui/label";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/ui/components/ui/toggle-group";
import { cn } from "@repo/ui/lib/utils";

import { api } from "~/trpc/react";
import { DEFAULT_RENDER_IN_NODE_MATERIAL_ROTATION } from "../../stores/constants";
import type { BaseNode } from "../../types/node";
import { GeometryRenderer } from "../webgl/geometry-renderer";
import { WebGLViewContext } from "../webgl/webgl-context";

export const MaterialNode = memo(
  ({ id, type, selected }: NodeProps<BaseNode>) => {
    const [data] = api.tenant.node.data.get.useSuspenseQuery<Material>({ id });
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
              <ToggleGroupItem value="renderInNode" variant="outline" size="xs">
                <ArrowRightIcon className="h-3 w-3" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="flex h-32 w-72 items-center justify-center border">
            <WebGLViewContext>
              <GeometryRenderer
                geometry={createDefaultGeometry({
                  type: "torus",
                  rotation: DEFAULT_RENDER_IN_NODE_MATERIAL_ROTATION,
                })}
              />
            </WebGLViewContext>
          </div>
        </div>
      </BaseNodeComponent>
    );
  },
);
