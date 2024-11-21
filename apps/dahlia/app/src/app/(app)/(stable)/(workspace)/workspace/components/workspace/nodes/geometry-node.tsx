import { useEffect } from "react";
import { Handle, NodeProps, Position } from "@xyflow/react";
import { ArrowRightIcon } from "lucide-react";

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
import { NetworkEditorContext } from "../../../state/context";
import { GeometryFlowNode } from "../../../types/flow-nodes";

export const GeometryNode = ({
  data: flowData,
  id,
  type,
  isConnectable,
}: NodeProps<GeometryFlowNode>) => {
  const machineRef = NetworkEditorContext.useActorRef();
  useEffect(() => {
    console.log("created", id);
  }, []);
  const { data } = flowData;
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
                machineRef.send({
                  type: "UPDATE_GEOMETRY",
                  geometryId: id,
                  value: {
                    shouldRenderInNode: !data.shouldRenderInNode,
                  },
                });
              }}
            >
              <ArrowRightIcon className="h-3 w-3" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="flex h-32 w-72 items-center justify-center border">
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
            shouldRender={data.shouldRenderInNode}
          />
        </div>

        <div className="flex items-center justify-end">
          <Checkbox
            id={`wireframe-${id}`}
            checked={data.wireframe}
            onCheckedChange={() => {
              machineRef.send({
                type: "UPDATE_GEOMETRY",
                geometryId: id,
                value: {
                  wireframe: !data.wireframe,
                },
              });
            }}
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
