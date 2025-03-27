import type { NodeProps } from "@xyflow/react";
import { memo, useState } from "react";
import Image from "next/image";
import { PlayIcon } from "lucide-react";

import type { Txt2Img } from "@dahlia/db/tenant/schema";
import { createFalClient } from "@repo/ai/fal";
import { BaseNodeComponent } from "@repo/ui/components/base-node";
import { Label } from "@repo/ui/components/ui/label";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/ui/components/ui/toggle-group";
import { cn } from "@repo/ui/lib/utils";

import type { BaseNode } from "../../types/node";
import { api } from "~/trpc/client/react";
import { useInspectorStore } from "../../providers/inspector-store-provider";

const fal = createFalClient({
  proxyUrl: "/api/fal/proxy",
});

export const FluxNode = memo(
  ({ id, type, selected, isConnectable }: NodeProps<BaseNode>) => {
    const [data] = api.tenant.node.data.get.useSuspenseQuery<Txt2Img>({ id });
    const setSelected = useInspectorStore((state) => state.setSelected);
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const generateImage = async () => {
      try {
        setLoading(true);
        const { data: output } = await fal.subscribe("fal-ai/fast-sdxl", {
          input: {
            prompt: data.prompt,
            image_size: "square_hd",
          },
          logs: true,
          onQueueUpdate(update) {
            if (
              update.status === "IN_PROGRESS" ||
              update.status === "COMPLETED"
            ) {
              setLogs((update.logs || []).map((log) => log.message));
            }
          },
        });
        setResult(output.images[0]?.url ?? "");
      } catch (error: any) {
        setError(error);
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

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
            `relative cursor-pointer flex-col space-y-1 p-1 text-card-foreground shadow-sm`,
          )}
        >
          <div className="flex flex-row items-center justify-between">
            <Label className="font-mono text-xs font-bold uppercase tracking-widest">
              {data.type}
            </Label>
          </div>

          <div className="flex flex-row gap-1">
            <div className="h-32 w-72 overflow-hidden border">
              {result && (
                <Image
                  src={result}
                  alt="Flux image"
                  width={512}
                  height={512}
                  className="object-contain"
                />
              )}
            </div>
          </div>

          <div className="flex flex-row justify-end gap-1">
            <ToggleGroup type="single" variant="outline" size="xs">
              <ToggleGroupItem
                value="generate"
                onClick={async (e) => {
                  e.stopPropagation();
                  generateImage();
                }}
              >
                <PlayIcon className="h-3 w-3" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </BaseNodeComponent>
    );
  },
);
