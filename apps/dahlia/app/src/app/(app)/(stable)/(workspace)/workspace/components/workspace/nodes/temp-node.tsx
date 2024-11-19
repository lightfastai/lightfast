import { memo } from "react";
import { NodeProps } from "@xyflow/react";
import { Circle, Square, Triangle } from "lucide-react";

import { TempFlowNode } from "../../../types/flow-nodes";

const GeometryPreview = ({ geometryType }: { geometryType?: string }) => {
  const getPreviewIcon = () => {
    if (!geometryType) return null;

    switch (geometryType.toLowerCase()) {
      case "box":
        return <Square className="h-8 w-8" />;
      case "sphere":
        return <Circle className="h-8 w-8" />;
      case "plane":
        return <Triangle className="h-8 w-8" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-48 w-72 flex-col items-center justify-center border-2 border-dashed border-primary bg-background/50">
      {getPreviewIcon()}
      <span className="mt-2 text-sm text-muted-foreground">
        Click to place {geometryType} node
      </span>
    </div>
  );
};

const MaterialPreview = () => (
  <div className="flex h-48 w-72 items-center justify-center border-2 border-dashed border-primary bg-background/50">
    <span className="text-sm text-muted-foreground">
      Click to place material node
    </span>
  </div>
);

export const TempNode = memo(({ data }: NodeProps<TempFlowNode>) => {
  return (
    <div className="pointer-events-none opacity-50">
      {data.node_to_add === "geometry" && (
        <GeometryPreview geometryType={data.preview?.geometryType} />
      )}
      {data.node_to_add === "material" && <MaterialPreview />}
    </div>
  );
});

TempNode.displayName = "TempNode";
