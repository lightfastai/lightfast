import type { AppRouterOutputs } from "@api/app";
import { Button } from "@repo/ui/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import {
  Loading03Icon as Loader2,
  ReloadIcon as RefreshCcw,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMemo } from "react";
import { useTRPC } from "~/trpc/react";
import { AutomationRunDetailSheet } from "./automation-run-detail-sheet";
import { AutomationRunsList } from "./automation-runs-list";
import { AUTOMATION_RUNS_PAGE_LIMIT } from "./automations-cache";

type AutomationRun =
  AppRouterOutputs["org"]["workspace"]["automations"]["listRuns"][number];

export function AutomationRunsSection({
  automationId,
  selectedRunId,
  setSelectedRunId,
}: {
  automationId: string;
  selectedRunId: string | null;
  setSelectedRunId: (publicId: string | null) => void;
}) {
  const trpc = useTRPC();

  const runsQuery = useQuery({
    ...trpc.org.workspace.automations.listRuns.queryOptions({
      id: automationId,
      limit: AUTOMATION_RUNS_PAGE_LIMIT,
    }),
    // Initial runs are prefetched by the automation detail route loader; this
    // gate only keeps background refreshes browser-side after hydration.
    enabled: typeof window !== "undefined",
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });

  const runs = runsQuery.data ?? [];
  const runsByPublicId = useMemo(() => {
    const map = new Map<string, AutomationRun>();
    for (const run of runs) {
      map.set(run.publicId, run);
    }
    return map;
  }, [runs]);

  if (runsQuery.isPending) {
    return (
      <p className="inline-flex items-center gap-2 text-muted-foreground text-sm">
        <HugeiconsIcon icon={Loader2} className="size-3.5 animate-spin" />
        Loading
      </p>
    );
  }

  if (runsQuery.isError) {
    return (
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">Unable to load runs.</p>
        <Button
          className="gap-2"
          onClick={() => void runsQuery.refetch()}
          size="sm"
          type="button"
          variant="secondary"
        >
          <HugeiconsIcon icon={RefreshCcw} className="size-3.5" />
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <>
      <AutomationRunsList
        onSelectRun={setSelectedRunId}
        runs={runs}
        selectedRunId={selectedRunId}
      />
      <AutomationRunDetailSheet
        initialRun={
          selectedRunId ? runsByPublicId.get(selectedRunId) : undefined
        }
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setSelectedRunId(null);
          }
        }}
        publicId={selectedRunId}
      />
    </>
  );
}
