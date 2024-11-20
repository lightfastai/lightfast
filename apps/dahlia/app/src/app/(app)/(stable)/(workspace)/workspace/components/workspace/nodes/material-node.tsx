import { memo } from "react";
import { NodeProps } from "@xyflow/react";
import { ArrowRightIcon } from "lucide-react";

import { $GeometryType } from "@repo/db/schema";
import { Label } from "@repo/ui/components/ui/label";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/ui/components/ui/toggle-group";
import { cn } from "@repo/ui/lib/utils";

import {
  CENTER_OF_WORLD,
  DEFAULT_RENDER_IN_NODE_MATERIAL_ROTATION,
  DEFAULT_SCALE,
  WORLD_CAMERA_POSITION_CLOSE,
} from "~/components/constants";
import { GeometryViewer } from "~/components/r3f/geometry-viewer";
import { MaterialFlowNode } from "../../../types/flow-nodes";

export const MaterialNode = memo(
  ({ data, id, isConnectable }: NodeProps<MaterialFlowNode>) => {
    const { color, type } = data;
    return (
      <div
        key={id}
        className={cn(
          `flex cursor-pointer flex-col gap-y-1 border bg-card p-1 text-card-foreground shadow-sm`,
        )}
      >
        <div className="flex flex-row items-center justify-between">
          <Label className="font-mono text-xs font-bold uppercase tracking-widest">
            {type}
          </Label>
          <ToggleGroup type="single">
            <ToggleGroupItem
              value="renderInNode"
              variant="outline"
              size="xs"
              // onClick={() => {
              //   machineRef.send({
              //     type: "UPDATE_MATERIAL",
              //     materialId: material.id,
              //     value: {
              //       shouldRenderInNode: !material.shouldRenderInNode,
              //     },
              //   });
              // }}
            >
              <ArrowRightIcon className="h-3 w-3" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="flex h-32 w-72 items-center justify-center border">
          <GeometryViewer
            geometries={[
              {
                id: Date.now(),
                type: $GeometryType.Enum.torus,
                position: CENTER_OF_WORLD,
                scale: DEFAULT_SCALE,
                inputPos: {
                  x: data.x,
                  y: data.y,
                },
                outputPos: {
                  x: data.x,
                  y: data.y,
                },
                x: data.x,
                y: data.y,
                wireframe: false,
                material: data,
                rotation: DEFAULT_RENDER_IN_NODE_MATERIAL_ROTATION,
                shouldRenderInNode: true,
              },
            ]}
            cameraPosition={WORLD_CAMERA_POSITION_CLOSE}
            lookAt={CENTER_OF_WORLD}
            shouldRenderGrid={false}
            shouldRenderAxes={false}
            shouldRender={data.shouldRenderInNode}
          />
        </div>
      </div>
    );
  },
);
