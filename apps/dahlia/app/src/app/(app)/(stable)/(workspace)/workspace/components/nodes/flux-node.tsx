import { memo } from "react";
import { NodeProps } from "@xyflow/react";
import { ArrowRightIcon } from "lucide-react";

import { Flux } from "@repo/db/schema";
import { BaseNodeComponent } from "@repo/ui/components/base-node";
import { Label } from "@repo/ui/components/ui/label";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/ui/components/ui/toggle-group";
import { cn } from "@repo/ui/lib/utils";

import { api } from "~/trpc/react";
import { useInspectorStore } from "../../providers/inspector-store-provider";
import { BaseNode } from "../../types/node";

export const FluxNode = memo(
  ({ id, type, selected, isConnectable }: NodeProps<BaseNode>) => {
    const [data] = api.node.data.get.useSuspenseQuery<Flux>({ id });
    const setSelected = useInspectorStore((state) => state.setSelected);
    return (
      <BaseNodeComponent
        id={id}
        selected={selected}
        onClick={() => {
          setSelected({ id, type });
        }}
      >
        <div
          key={id}
          className={cn(
            `relative cursor-pointer flex-col gap-1 border p-1 text-card-foreground shadow-sm`,
          )}
        >
          <div className="flex flex-row items-center justify-between">
            <Label className="font-mono text-xs font-bold uppercase tracking-widest">
              {data.type} {id}
            </Label>
            <ToggleGroup type="single">
              <ToggleGroupItem
                value="renderInNode"
                variant="outline"
                size="xs"
                onClick={() => {
                  // machineRef.send({
                  //   type: "UPDATE_TEXTURE",
                  //   textureId: data.id,
                  //   value: {
                  //     shouldRenderInNode: !data.shouldRenderInNode,
                  //   },
                  // });
                }}
              >
                <ArrowRightIcon className="h-3 w-3" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="mt-1 flex flex-row gap-1">
            <div className="h-32 w-72 border">{/** Something goes here */}</div>
          </div>
        </div>
      </BaseNodeComponent>
    );
  },
);
