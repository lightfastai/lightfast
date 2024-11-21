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
import { NetworkEditorContext } from "../../../state/context";
import { FlowNode } from "../../../types/flow-nodes";

export const GeometryNode = ({
  data,
  id,
  type,
  isConnectable,
}: NodeProps<FlowNode>) => {
  const machineRef = NetworkEditorContext.useActorRef();
  const { dbId: geometryId, workspaceId } = data;
  const { data: geometryData } = api.node.getData.useQuery<Geometry>({
    id: geometryId,
    workspaceId,
  });
  const utils = api.useUtils();

  const updateRenderInNode = api.node.updateRenderInNode.useMutation({
    // optimistic update
    onMutate: async (input) => {
      await utils.node.getData.cancel({ id: geometryId, workspaceId });
      const previousGeometryData = utils.node.getData.getData({
        id: geometryId,
        workspaceId,
      }) as Geometry;
      utils.node.getData.setData(
        { id: geometryId, workspaceId },
        {
          ...previousGeometryData,
          shouldRenderInNode: input.shouldRenderInNode,
        },
      );
      return { previousGeometryData };
    },
    onSuccess: (data, variables, context) => {
      console.log("success", data, variables, context);
      if (!context) return;
      utils.node.getData.setData(
        { id: geometryId, workspaceId },
        context.previousGeometryData,
      );
    },
    onError: (error, variables, context) => {
      if (!context) return;
      utils.node.getData.setData(
        { id: geometryId, workspaceId },
        context.previousGeometryData,
      );
    },
    onSettled: () => {
      utils.node.getData.invalidate({ id: geometryId, workspaceId });
    },
  });

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
                if (!geometryData) return;
                updateRenderInNode.mutate({
                  id: geometryId,
                  workspaceId,
                  shouldRenderInNode: !geometryData.shouldRenderInNode,
                });
              }}
            >
              <ArrowRightIcon className="h-3 w-3" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="flex h-32 w-72 items-center justify-center border">
          {geometryData && geometryData.shouldRenderInNode && (
            <GeometryViewer
              geometries={[
                {
                  ...geometryData,
                  position: CENTER_OF_WORLD,
                },
              ]}
              cameraPosition={WORLD_CAMERA_POSITION_CLOSE}
              lookAt={CENTER_OF_WORLD}
              shouldRenderGrid={false}
              shouldRenderAxes={false}
              shouldRender={geometryData?.shouldRenderInNode ?? false}
            />
          )}
        </div>

        <div className="flex items-center justify-end">
          <Checkbox
            id={`wireframe-${id}`}
            checked={geometryData?.wireframe ?? false}
            onCheckedChange={() => {
              machineRef.send({
                type: "UPDATE_GEOMETRY",
                geometryId: id,
                value: {
                  wireframe: !geometryData?.wireframe,
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
