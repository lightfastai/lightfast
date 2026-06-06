"use client";

import { cn } from "@repo/ui/lib/utils";
import { useIsMutating, useSuspenseQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Suspense } from "react";
import { useTRPC } from "~/trpc/react";
import { AutomationActions } from "./automation-actions";
import { AutomationNameEditor } from "./automation-name-editor";
import { AutomationPromptEditor } from "./automation-prompt-editor";
import { AutomationRunsSection } from "./automation-runs-section";
import { AutomationScheduleEditor } from "./automation-schedule-editor";
import { AutomationStatusChip } from "./automation-status-chip";
import { RailRow, RailSection } from "./detail-sections";

const CONNECTOR_LABELS = {
  linear: "Linear",
  x: "X",
} as const;

function formatDate(date: Date | null | undefined): string {
  if (!date) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatConnectorProvider(
  provider: keyof typeof CONNECTOR_LABELS | null | undefined
) {
  return provider ? CONNECTOR_LABELS[provider] : "—";
}

function TimestampValue({
  date,
  pending = false,
}: {
  date: Date | null | undefined;
  pending?: boolean;
}) {
  if (!date) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }
  // Plain read-only value (not a pill) — these timestamps aren't editable, so
  // they shouldn't read as clickable. The timestamp formats in the viewer's
  // locale/timezone, which legitimately differs from the server's during SSR,
  // so suppress the unavoidable text-only hydration diff. While a schedule edit
  // is in flight the server is recomputing the next run, so dim it with a small
  // spinner until the authoritative value lands.
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm",
        pending ? "text-muted-foreground" : "text-foreground"
      )}
      suppressHydrationWarning
    >
      {pending ? <Loader2 className="size-3 animate-spin" /> : null}
      {formatDate(date)}
    </span>
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

  // A schedule edit is the only `automations.update` that recomputes the
  // server-derived "Next run"; scope the pending affordance to those (the
  // schedule editor always sends `schedule`) so a name/prompt edit doesn't
  // flicker it. The optimistic "Repeats" label has already updated by then.
  const isRecomputingSchedule =
    useIsMutating({
      mutationKey: trpc.org.workspace.automations.update.mutationKey(),
      predicate: (mutation) =>
        (mutation.state.variables as { schedule?: unknown } | undefined)
          ?.schedule !== undefined,
    }) > 0;

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

      {/* Right — status / details / actions / previous runs. The left border is
          the full-height divider: the grid pins both columns to the viewport, so
          it always spans from the top down. Scrolls on its own when it overflows. */}
      <div className="space-y-8 px-6 py-10 lg:min-h-0 lg:overflow-y-auto lg:border-border lg:border-l lg:px-8 lg:py-12">
        <RailSection title="Status">
          <AutomationStatusChip automation={automation} />
          <RailRow label="Next run">
            <TimestampValue
              date={automation.nextRunAt}
              pending={isRecomputingSchedule}
            />
          </RailRow>
          <RailRow label="Last ran">
            <TimestampValue date={automation.lastRunAt} />
          </RailRow>
        </RailSection>

        <RailSection title="Details">
          <AutomationScheduleEditor automation={automation} />
          <RailRow label="Connector">
            <span className="text-sm">
              {formatConnectorProvider(automation.connectorProvider)}
            </span>
          </RailRow>
        </RailSection>

        <AutomationActions automation={automation} />

        <RailSection title="Previous runs">
          <Suspense
            fallback={<p className="text-muted-foreground text-sm">Loading…</p>}
          >
            <AutomationRunsSection automationId={automationId} />
          </Suspense>
        </RailSection>
      </div>
    </div>
  );
}
