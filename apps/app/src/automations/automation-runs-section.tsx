import {
  Loading03Icon as Loader2,
  ReloadIcon as RefreshCcw,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@repo/ui/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { AutomationRunDetailSheet } from "./automation-run-detail-sheet";
import { AutomationRunsList } from "./automation-runs-list";
import {
  AUTOMATION_RUNS_PAGE_LIMIT,
  type AutomationRunListItem,
  automationRunsQueryOptions,
} from "./automations-queries";

export function AutomationRunsSection({
  automationId,
  selectedRunId,
  setSelectedRunId,
}: {
  automationId: string;
  selectedRunId: string | null;
  setSelectedRunId: (publicId: string | null) => void;
}) {
  const runsQuery = useQuery(
    automationRunsQueryOptions({
      enabled: typeof window !== "undefined",
      id: automationId,
      limit: AUTOMATION_RUNS_PAGE_LIMIT,
      refetchOnWindowFocus: true,
      staleTime: 5000,
    })
  );

  const runs = runsQuery.data ?? [];
  const runsByPublicId = useMemo(() => {
    const map = new Map<string, AutomationRunListItem>();
    for (const run of runs) {
      map.set(run.publicId, run);
    }
    return map;
  }, [runs]);

  if (runsQuery.isPending) {
    return (
      <p className="inline-flex items-center gap-2 text-muted-foreground text-sm">
        <HugeiconsIcon className="size-3.5 animate-spin" icon={Loader2} />
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
          <HugeiconsIcon className="size-3.5" icon={RefreshCcw} />
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
