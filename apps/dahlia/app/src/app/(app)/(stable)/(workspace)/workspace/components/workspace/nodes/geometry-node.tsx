import { memo } from "react";
import { Node, NodeProps } from "@xyflow/react";
import { ArrowRightIcon, TrashIcon } from "lucide-react";

import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Label } from "@repo/ui/components/ui/label";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/ui/components/ui/toggle-group";
import { cn } from "@repo/ui/lib/utils";

import {
  CENTER_OF_WORLD,
  DEFAULT_POSITION,
  DEFAULT_ROTATION,
  DEFAULT_SCALE,
  WORLD_CAMERA_POSITION_CLOSE,
} from "~/components/constants";
import { GeometryViewer } from "~/components/r3f/geometry-viewer";
import { NetworkEditorContext } from "../../../state/context";

export type GeometryNodeData = Node<
  {
    geometryId: number;
  },
  "geometry"
>;

export const GeometryNode = memo(({ data }: NodeProps<GeometryNodeData>) => {
  const { geometryId } = data;

  const machineRef = NetworkEditorContext.useActorRef();
  // const { geometry } = useGetGeometry({ geometryId });
  const geometry = {
    id: geometryId,
    position: DEFAULT_POSITION,
    scale: DEFAULT_SCALE,
    rotation: DEFAULT_ROTATION,
    wireframe: false,
    type: "Box",
    material: null,
    shouldRenderInNode: true,
    inputPos: { x: 0, y: 0 },
    outputPos: { x: 0, y: 0 },
  };

  const handleGeometryClick = () => {
    if (!geometry) return;
    machineRef.send({ type: "UPDATE_SELECTED_PROPERTY", property: geometry });
  };

  return (
    <div
      className={cn(
        "flex cursor-pointer flex-col gap-y-1 border bg-card p-1 text-card-foreground shadow-sm",
        "node-container", // Additional class for React Flow styling
      )}
      onClick={handleGeometryClick}
    >
      <div className="flex flex-row items-center justify-between">
        <Label className="font-mono text-xs font-bold uppercase tracking-widest">
          {geometry.type}
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
                geometryId: geometry.id,
                value: {
                  shouldRenderInNode: !geometry.shouldRenderInNode,
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
                geometryId: geometry.id,
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
              ...geometry,
              position: CENTER_OF_WORLD,
            },
          ]}
          cameraPosition={WORLD_CAMERA_POSITION_CLOSE}
          lookAt={CENTER_OF_WORLD}
          shouldRenderGrid={false}
          shouldRenderAxes={false}
          shouldRender={geometry.shouldRenderInNode}
        />
      </div>

      <div className="flex items-center justify-end">
        <Checkbox
          id={`wireframe-${geometry.id}`}
          checked={geometry.wireframe}
          onCheckedChange={() => {
            machineRef.send({
              type: "UPDATE_GEOMETRY",
              geometryId: geometry.id,
              value: {
                wireframe: !geometry.wireframe,
              },
            });
          }}
        />
      </div>
    </div>
  );
});

GeometryNode.displayName = "GeometryNode";
