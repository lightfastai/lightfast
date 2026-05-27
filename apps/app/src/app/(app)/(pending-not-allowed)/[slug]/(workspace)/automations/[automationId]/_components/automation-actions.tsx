"use client";

import type { AppRouterOutputs } from "@api/app";
import { Button } from "@repo/ui/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@vendor/clerk";
import { Loader2, Play, Trash } from "lucide-react";
import { useTRPC } from "~/trpc/react";

type Automation = AppRouterOutputs["org"]["workspace"]["automations"]["get"];

export function AutomationActions({
  automation,
}: {
  automation: Automation;
}) {
  const { has, isLoaded } = useAuth();
  const canManage = isLoaded && !!has?.({ role: "org:admin" });

  if (!canManage) return null;

  return <AutomationActionsInner automation={automation} />;
}

function AutomationActionsInner({ automation }: { automation: Automation }) {
  const qc = useQueryClient();
  const trpc = useTRPC();
  const id = automation.publicId;

  const listRunsKey = trpc.org.workspace.automations.listRuns.queryOptions({
    id,
    limit: 20,
  }).queryKey;

  const runNowMutation = useMutation(
    trpc.org.workspace.automations.runNow.mutationOptions({
      meta: { errorTitle: "Failed to enqueue run" },
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: listRunsKey });
      },
    }),
  );

  return (
    <div className="space-y-2 border-border border-t pt-4">
      <Button
        className="w-full justify-start gap-2"
        disabled={runNowMutation.isPending || automation.status === "paused"}
        onClick={() => runNowMutation.mutate({ id })}
        size="sm"
        variant="secondary"
      >
        {runNowMutation.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Play className="size-4" />
        )}
        Run now
      </Button>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="block w-full" tabIndex={0}>
            <Button
              aria-disabled
              className="pointer-events-none w-full justify-start gap-2"
              size="sm"
              tabIndex={-1}
              variant="secondary"
            >
              <Trash className="size-4" />
              Delete
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          Delete isn&apos;t available yet — pause the automation instead.
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
