import { ArrowRightIcon, TrashIcon } from "lucide-react";

import { Label } from "@repo/ui/components/ui/label";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/ui/components/ui/toggle-group";
import { cn } from "@repo/ui/lib/utils";

import type { Material } from "../app/(app)/(stable)/(network-editor)/types/primitives";
import { NetworkEditorContext } from "~/app/(app)/(stable)/(network-editor)/state/context";
import { $GeometryType } from "../app/(app)/(stable)/(network-editor)/types/primitives.schema";
import {
  CENTER_OF_WORLD,
  DEFAULT_RENDER_IN_NODE_MATERIAL_ROTATION,
  DEFAULT_SCALE,
  WORLD_CAMERA_POSITION_CLOSE,
} from "./constants";
import { GeometryViewer } from "./r3f/geometry-viewer";

export const NetworkMaterialNode = ({ materialId }: { materialId: number }) => {
  const material = NetworkEditorContext.useSelector((state) =>
    state.context.materials.find((m) => m.id === materialId),
  );
  const machineRef = NetworkEditorContext.useActorRef();

  // Geometry Drag Handlers
  const handleMaterialClick = (material: Material) => {
    machineRef.send({ type: "UPDATE_SELECTED_PROPERTY", property: material });
  };

  if (!material) return null;

  return (
    <div
      key={material.id}
      className={cn(
        `flex cursor-pointer flex-col gap-y-1 border bg-card p-1 text-card-foreground shadow-sm`,
      )}
      onClick={() => handleMaterialClick(material)}
    >
      <div className="flex flex-row items-center justify-between">
        <Label className="font-mono text-xs font-bold uppercase tracking-widest">
          {material.type}
        </Label>
        <ToggleGroup type="single">
          <ToggleGroupItem
            value="renderInNode"
            variant="outline"
            size="xs"
            onClick={() => {
              machineRef.send({
                type: "UPDATE_MATERIAL",
                materialId: material.id,
                value: {
                  shouldRenderInNode: !material.shouldRenderInNode,
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
                type: "DELETE_MATERIAL",
                materialId: material.id,
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
              id: Date.now(),
              type: $GeometryType.Enum.Torus,
              position: CENTER_OF_WORLD,
              scale: DEFAULT_SCALE,
              inputPos: {
                x: material.x,
                y: material.y,
              },
              outputPos: {
                x: material.x,
                y: material.y,
              },
              x: material.x,
              y: material.y,
              wireframe: false,
              material,
              rotation: DEFAULT_RENDER_IN_NODE_MATERIAL_ROTATION,
              shouldRenderInNode: true,
            },
          ]}
          cameraPosition={WORLD_CAMERA_POSITION_CLOSE}
          lookAt={CENTER_OF_WORLD}
          shouldRenderGrid={false}
          shouldRenderAxes={false}
          shouldRender={material.shouldRenderInNode}
        />
      </div>
    </div>
  );
};
