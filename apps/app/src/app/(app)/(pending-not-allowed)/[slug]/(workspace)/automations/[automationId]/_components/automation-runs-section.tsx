"use client";

import type { AppRouterOutputs } from "@api/app";
import { useSuspenseQuery } from "@tanstack/react-query";
import { parseAsString, useQueryState } from "nuqs";
import { useMemo } from "react";
import { useTRPC } from "~/trpc/react";
import { AUTOMATION_RUNS_PAGE_LIMIT } from "../../_components/automations-cache";
import { AutomationRunDetailSheet } from "./automation-run-detail-sheet";
import { AutomationRunsList } from "./automation-runs-list";

type AutomationRun =
  AppRouterOutputs["org"]["workspace"]["automations"]["listRuns"][number];

export function AutomationRunsSection({
  automationId,
}: {
  automationId: string;
}) {
  const trpc = useTRPC();
  const [selectedRunId, setSelectedRunId] = useQueryState("run", parseAsString);

  const { data: runs } = useSuspenseQuery({
    ...trpc.org.workspace.automations.listRuns.queryOptions({
      id: automationId,
      limit: AUTOMATION_RUNS_PAGE_LIMIT,
    }),
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });

  const runsByPublicId = useMemo(() => {
    const map = new Map<string, AutomationRun>();
    for (const run of runs) {
      map.set(run.publicId, run);
    }
    return map;
  }, [runs]);

  return (
    <>
      <AutomationRunsList
        onSelectRun={(publicId) => void setSelectedRunId(publicId)}
        runs={runs}
        selectedRunId={selectedRunId}
      />
      <AutomationRunDetailSheet
        initialRun={
          selectedRunId ? runsByPublicId.get(selectedRunId) : undefined
        }
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            void setSelectedRunId(null);
          }
        }}
        publicId={selectedRunId}
      />
    </>
  );
}
