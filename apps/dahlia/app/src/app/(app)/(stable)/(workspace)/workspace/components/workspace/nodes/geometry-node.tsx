import { Handle, NodeProps, Position } from "@xyflow/react";
import { ArrowRightIcon } from "lucide-react";

import { Geometry } from "@repo/db/schema";
import { BaseNode } from "@repo/ui/components/base-node";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Label } from "@repo/ui/components/ui/label";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/ui/components/ui/toggle-group";
import { cn } from "@repo/ui/lib/utils";

import {
  CENTER_OF_WORLD,
  WORLD_CAMERA_POSITION_CLOSE,
} from "~/components/constants";
import { GeometryViewer } from "~/components/r3f/geometry-viewer";
import { api } from "~/trpc/react";
import { FlowNode } from "../../../types/node";

export const GeometryNode = ({
  id,
  type,
  isConnectable,
}: NodeProps<FlowNode>) => {
  const { data } = api.node.getData.useQuery<Geometry>({ id });
  return (
    <BaseNode>
      <div
        className={cn(
          "flex cursor-pointer flex-col gap-y-1 p-1 text-card-foreground shadow-sm",
          "node-container",
        )}
      >
        <Handle
          type="target"
          position={Position.Left}
          isConnectable={isConnectable}
        />

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
                if (!data) return;
              }}
            >
              <ArrowRightIcon className="h-3 w-3" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="flex h-32 w-72 items-center justify-center border">
          {data && data.shouldRenderInNode && (
            <GeometryViewer
              geometries={[
                {
                  ...data,
                  position: CENTER_OF_WORLD,
                },
              ]}
              cameraPosition={WORLD_CAMERA_POSITION_CLOSE}
              lookAt={CENTER_OF_WORLD}
              shouldRenderGrid={false}
              shouldRenderAxes={false}
              shouldRender={data.shouldRenderInNode ?? false}
            />
          )}
        </div>

        <div className="flex items-center justify-end">
          <Checkbox
            id={`wireframe-${id}`}
            checked={data?.wireframe ?? false}
            // onCheckedChange={() => {}}
          />
        </div>

        <Handle
          type="source"
          position={Position.Right}
          isConnectable={isConnectable}
        />
      </div>
    </BaseNode>
  );
};

GeometryNode.displayName = "GeometryNode";
