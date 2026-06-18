import { Button } from "@repo/ui/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCcw } from "lucide-react";
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
        <Loader2 className="size-3.5 animate-spin" />
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
          <RefreshCcw className="size-3.5" />
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
