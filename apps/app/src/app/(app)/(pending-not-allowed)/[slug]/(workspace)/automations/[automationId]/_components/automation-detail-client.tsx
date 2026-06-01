"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { useTRPC } from "~/trpc/react";
import { AutomationActions } from "./automation-actions";
import { AutomationNameEditor } from "./automation-name-editor";
import { AutomationPromptEditor } from "./automation-prompt-editor";
import { AutomationRunsList } from "./automation-runs-list";
import { AutomationScheduleEditor } from "./automation-schedule-editor";
import { AutomationStatusChip } from "./automation-status-chip";
import { RailRow, RailSection, RailValuePill } from "./detail-sections";

function formatDate(date: Date | null | undefined): string {
  if (!date) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function TimestampValue({ date }: { date: Date | null | undefined }) {
  if (!date) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }
  // The timestamp formats in the viewer's locale/timezone, which legitimately
  // differs from the server's during SSR. Suppress the unavoidable text-only
  // hydration diff so React keeps the client-formatted value without warning.
  return (
    <RailValuePill>
      <span suppressHydrationWarning>{formatDate(date)}</span>
    </RailValuePill>
  );
}

export function AutomationDetailClient({
  automationId,
}: {
  automationId: string;
}) {
  const trpc = useTRPC();

  const { data: automation } = useSuspenseQuery({
    ...trpc.org.workspace.automations.get.queryOptions({ id: automationId }),
    staleTime: 30_000,
  });

  return (
    // On lg the grid is pinned to the viewport height (lg:h-full) so each column
    // owns its own scroll instead of growing the page. On smaller screens it
    // falls back to normal stacked page flow.
    <div className="grid grid-cols-1 lg:h-full lg:grid-cols-[minmax(0,1fr)_22rem]">
      {/* Left — the document: title + always-editable markdown instructions.
          Scrolls internally once the content outgrows the viewport. */}
      <div className="min-w-0 px-8 py-10 lg:min-h-0 lg:overflow-y-auto lg:px-12 lg:py-12">
        <AutomationNameEditor automation={automation} />
        <div className="mt-6">
          <AutomationPromptEditor automation={automation} />
        </div>
      </div>

      {/* Right — status / details / previous runs. The left border is the
          full-height divider: the grid pins both columns to the viewport, so it
          always spans from the top down. Scrolls on its own when it overflows. */}
      <div className="space-y-8 px-6 py-10 lg:min-h-0 lg:overflow-y-auto lg:border-border lg:border-l lg:px-8 lg:py-12">
        <RailSection title="Status">
          <AutomationStatusChip automation={automation} />
          <RailRow label="Next run">
            <TimestampValue date={automation.nextRunAt} />
          </RailRow>
          <RailRow label="Last ran">
            <TimestampValue date={automation.lastRunAt} />
          </RailRow>
        </RailSection>

        <RailSection title="Details">
          <AutomationScheduleEditor automation={automation} />
        </RailSection>

        <RailSection title="Previous runs">
          <Suspense
            fallback={<p className="text-muted-foreground text-sm">Loading…</p>}
          >
            <AutomationRunsList automationId={automationId} />
          </Suspense>
        </RailSection>

        <AutomationActions automation={automation} />
      </div>
    </div>
  );
}
