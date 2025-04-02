import type { NodeProps } from "@xyflow/react";
import { memo } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import { Monitor } from "lucide-react";

import type { Window } from "@vendor/db/types";
import { BaseNodeComponent } from "@repo/ui/components/base-node";
import { Button } from "@repo/ui/components/ui/button";
import { Label } from "@repo/ui/components/ui/label";
import { cn } from "@repo/ui/lib/utils";

import type { BaseNode } from "../../types/node";
import { api } from "~/trpc/client/react";
import { useTextureRenderStore } from "../../providers/texture-render-store-provider";

export const WindowNode = memo(function WindowNode({
  id,
  type,
  selected,
}: NodeProps<BaseNode>) {
  const [nodeData] = api.tenant.node.data.get.useSuspenseQuery<Window>({ id });
  const { getNode, getEdges } = useReactFlow();
  const { targets } = useTextureRenderStore((state) => state);

  const handleOpenWindow = () => {
    // Get the input edge
    const inputEdge = getEdges().find((edge) => edge.target === id);
    if (!inputEdge) return;

    // Get the source node
    const sourceNode = getNode(inputEdge.source);
    if (!sourceNode) return;

    // Get the texture from the render store
    const sourceTexture = targets[inputEdge.source]?.texture;
    if (!sourceTexture) return;

    // Open the window route in a new tab
    window.open(`/workspace/${"aldbx3eec62r9kncbnif2"}/window/${id}`, "_blank");
  };

  const hasInput = getEdges().some((edge) => edge.target === id);

  return (
    <BaseNodeComponent selected={selected}>
      <div
        key={id}
        className={cn(
          "flex cursor-pointer flex-col gap-y-1 p-1 text-card-foreground shadow-sm",
        )}
      >
        <div className="flex flex-row items-center justify-between">
          <Label className="font-mono text-xs font-bold uppercase tracking-widest">
            {type} {id}
          </Label>
        </div>
        <div className="flex flex-col gap-2 p-2">
          <div className="text-sm">
            <Label className="text-xs font-medium">Status</Label>
            <div
              className={cn(
                "mt-1 rounded border p-2 text-xs",
                !hasInput && "border-dashed border-muted-foreground/50",
              )}
            >
              {hasInput ? "Connected" : "Connect an input"}
            </div>
          </div>
          <Button
            onClick={handleOpenWindow}
            disabled={!hasInput}
            className="w-full"
            size="sm"
          >
            <Monitor className="mr-2 h-4 w-4" />
            Open Window
          </Button>
        </div>
        <Handle type="target" position={Position.Left} className="h-10 w-3" />
      </div>
    </BaseNodeComponent>
  );
});
