import { memo } from "react";
import { Handle, NodeProps, Position } from "@xyflow/react";
import { ArrowRightIcon, TrashIcon } from "lucide-react";

import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Label } from "@repo/ui/components/ui/label";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/ui/components/ui/toggle-group";
import { cn } from "@repo/ui/lib/utils";

import type { GeometryFlowNode } from "../../../types/flow-nodes";
import {
  CENTER_OF_WORLD,
  WORLD_CAMERA_POSITION_CLOSE,
} from "~/components/constants";
import { GeometryViewer } from "~/components/r3f/geometry-viewer";
import { NetworkEditorContext } from "../../../state/context";

interface GeometryNodeProps {
  data: GeometryFlowNode["data"];
  id: string;
  onDelete?: (id: string) => void;
}

// export function GeometryNode({ data, id, onDelete }: GeometryNodeProps) {
//   const handleDelete = (e: MouseEvent<HTMLButtonElement>) => {
//     e.stopPropagation();
//     onDelete?.(id);
//   };

//   return (
//     <div className="relative rounded-lg border border-border bg-card p-4 shadow-sm">
//       {onDelete && (
//         <Button
//           variant="ghost"
//           size="icon"
//           className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
//           onClick={handleDelete}
//         >
//           <X className="h-4 w-4" />
//         </Button>
//       )}

//       <div className="flex flex-col gap-2">
//         <div className="text-sm font-medium">{data.type}</div>
//       </div>

//       <Handle type="source" position={Position.Right} />
//       <Handle type="target" position={Position.Left} />
//     </div>
//   );
// }

export const GeometryNode = memo(
  ({ data, id, isConnectable }: NodeProps<GeometryFlowNode>) => {
    const machineRef = NetworkEditorContext.useActorRef();
    return (
      <div
        className={cn(
          "flex cursor-pointer flex-col gap-y-1 border bg-card p-1 text-card-foreground shadow-sm",
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
            {data.type}
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
            <ToggleGroupItem
              value="deleteGeometry"
              variant="outline"
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                machineRef.send({
                  type: "DELETE_GEOMETRY",
                  geometryId: id,
                });
              }}
            >
              <TrashIcon className="h-3 w-3" />
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
    );
  },
);

GeometryNode.displayName = "GeometryNode";
