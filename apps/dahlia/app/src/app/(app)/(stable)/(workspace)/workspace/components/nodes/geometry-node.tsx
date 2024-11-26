import { memo } from "react";
import { NodeProps } from "@xyflow/react";
import { ArrowRightIcon } from "lucide-react";

import { BaseNodeComponent } from "@repo/ui/components/base-node";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Label } from "@repo/ui/components/ui/label";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/ui/components/ui/toggle-group";
import { cn } from "@repo/ui/lib/utils";

import { GeometryRenderer } from "~/app/(app)/(stable)/(workspace)/workspace/components/webgl/geometry-renderer";
import { api } from "~/trpc/react";
import { Geometry } from "../../../../../../../../../../../packages/db/dist/app/src/schema";
import { BaseNode } from "../../types/node";
import { WebGLViewContext } from "../webgl/webgl-context";

export const GeometryNode = memo(
  ({ id, type, selected }: NodeProps<BaseNode>) => {
    const [data] = api.node.data.get.useSuspenseQuery<Geometry>({ id });
    return (
      <BaseNodeComponent selected={selected}>
        <div
          className={cn(
            "flex cursor-pointer flex-col gap-y-1 p-1 text-card-foreground shadow-sm",
          )}
        >
          <div className="flex flex-row items-center justify-between">
            <Label className="font-mono text-xs font-bold uppercase tracking-widest">
              {type} {id}
            </Label>
            <ToggleGroup type="single">
              <ToggleGroupItem
                value="renderInNode"
                variant="outline"
                size="xs"
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
              <GeometryRenderer geometry={data} />
            </WebGLViewContext>
          </div>

          <div className="flex items-center justify-end">
            <Checkbox
              id={`wireframe-${id}`}
              checked={data?.wireframe ?? false}
              // onCheckedChange={() => {}}
            />
          </div>
        </div>
      </BaseNodeComponent>
    );
  },
);
