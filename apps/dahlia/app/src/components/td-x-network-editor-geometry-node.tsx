import { ArrowRightIcon, TrashIcon } from "lucide-react";

import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Label } from "@repo/ui/components/ui/label";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/ui/components/ui/toggle-group";
import { cn } from "@repo/ui/lib/utils";

import type { Geometry } from "./types";
import { NetworkEditorContext } from "~/app/(app)/(stable)/(network-editor)/state/context";
import { CENTER_OF_WORLD, WORLD_CAMERA_POSITION_CLOSE } from "./constants";
import { GeometryViewer } from "./r3f/geometry-viewer";

export const NetworkGeometryNode = ({ geometryId }: { geometryId: number }) => {
  const geometry = NetworkEditorContext.useSelector((state) =>
    state.context.geometries.find((g) => g.id === geometryId),
  );
  const machineRef = NetworkEditorContext.useActorRef();

  const handleGeometryClick = (geometry: Geometry) => {
    machineRef.send({ type: "UPDATE_SELECTED_PROPERTY", property: geometry });
  };

  if (!geometry) return null;

  return (
    <div
      key={geometry.id}
      className={cn(
        `flex cursor-pointer flex-col gap-y-1 border bg-card p-1 text-card-foreground shadow-sm`,
      )}
      onClick={() => handleGeometryClick(geometry)}
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
            onClick={() => {
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
            onClick={() => {
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
};
