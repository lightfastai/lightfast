import type { AppRouterOutputs } from "@api/app";
import { useAuth } from "@clerk/tanstack-react-start";
import { Button } from "@repo/ui/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Play, Trash } from "lucide-react";
import { useTRPC } from "~/trpc/react";
import { AUTOMATION_RUNS_PAGE_LIMIT, upsertRun } from "./automations-cache";
import { RailSection } from "./detail-sections";

type Automation = AppRouterOutputs["org"]["workspace"]["automations"]["get"];

export function AutomationActions({ automation }: { automation: Automation }) {
  const { has, isLoaded } = useAuth();
  const canManage = isLoaded && !!has?.({ role: "org:admin" });

  if (!canManage) {
    return null;
  }

  return <AutomationActionsInner automation={automation} />;
}

function AutomationActionsInner({ automation }: { automation: Automation }) {
  const qc = useQueryClient();
  const trpc = useTRPC();
  const id = automation.publicId;

  const listRunsKey = trpc.org.workspace.automations.listRuns.queryOptions({
    id,
    limit: AUTOMATION_RUNS_PAGE_LIMIT,
  }).queryKey;

  const runNowMutation = useMutation(
    trpc.org.workspace.automations.runNow.mutationOptions({
      meta: { errorTitle: "Failed to enqueue run" },
      onSuccess: (run) => {
        upsertRun(qc, trpc, id, run);
        void qc.invalidateQueries({ queryKey: listRunsKey });
      },
    })
  );

  return (
    <RailSection title="Actions">
      <div className="space-y-2">
        <Button
          className="w-full justify-start gap-2"
          disabled={runNowMutation.isPending || automation.status === "paused"}
          onClick={() => runNowMutation.mutate({ id })}
          size="lf"
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
            <Button
              aria-disabled
              className="w-full cursor-not-allowed justify-start gap-2 opacity-50"
              size="lf"
              type="button"
              variant="secondary"
            >
              <Trash className="size-4" />
              Delete
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Delete is not available yet - pause the automation instead.
          </TooltipContent>
        </Tooltip>
      </div>
    </RailSection>
  );
}
