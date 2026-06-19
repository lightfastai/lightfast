import { getAutomation } from "@api/app/tanstack/automations";
import {
  ChevronLeftIcon as ChevronLeft,
  Loading03Icon as Loader2,
  ReloadIcon as RefreshCcw,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { SidebarTrigger } from "@repo/ui-v2/components/ui/sidebar";
import { useIsMutating, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AutomationActions } from "./automation-actions";
import { AutomationNameEditor } from "./automation-name-editor";
import { AutomationPromptEditor } from "./automation-prompt-editor";
import { AutomationRunsSection } from "./automation-runs-section";
import { AutomationScheduleEditor } from "./automation-schedule-editor";
import { AutomationStatusChip } from "./automation-status-chip";
import {
  automationMutationKeys,
  automationQueryKeys,
} from "./automations-cache";
import { RailRow, RailSection } from "./detail-sections";

const CONNECTOR_LABELS = {
  linear: "Linear",
  x: "X",
} as const;

function formatDate(date: Date | null | undefined): string {
  if (!date) {
    return "-";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function TimestampValue({
  date,
  pending = false,
}: {
  date: Date | null | undefined;
  pending?: boolean;
}) {
  if (!date) {
    return <span className="text-muted-foreground text-sm">-</span>;
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm",
        pending ? "text-muted-foreground" : "text-foreground"
      )}
      suppressHydrationWarning
    >
      {pending ? (
        <HugeiconsIcon className="size-3 animate-spin" icon={Loader2} />
      ) : null}
      {formatDate(date)}
    </span>
  );
}

function formatConnectorProvider(
  provider: keyof typeof CONNECTOR_LABELS | null | undefined
) {
  return provider ? CONNECTOR_LABELS[provider] : "-";
}

export function AutomationDetailClient({
  automationId,
  selectedRunId,
  setSelectedRunId,
  slug,
}: {
  automationId: string;
  selectedRunId: string | null;
  setSelectedRunId: (publicId: string | null) => void;
  slug: string;
}) {
  const automationQuery = useQuery({
    enabled: typeof window !== "undefined",
    queryFn: () => getAutomation({ data: { id: automationId } }),
    queryKey: automationQueryKeys.detail(automationId),
    staleTime: 30_000,
  });

  const isRecomputingSchedule =
    useIsMutating({
      mutationKey: automationMutationKeys.update(),
      predicate: (mutation) =>
        (mutation.state.variables as { schedule?: unknown } | undefined)
          ?.schedule !== undefined,
    }) > 0;

  if (automationQuery.isPending) {
    return <AutomationDetailSkeleton slug={slug} />;
  }

  if (automationQuery.isError || !automationQuery.data) {
    return (
      <div className="flex min-h-full items-center justify-center px-4 pb-24">
        <section className="w-full max-w-lg space-y-4">
          <AutomationDetailNav slug={slug} />
          <p className="font-mono text-muted-foreground text-sm">
            {automationId}
          </p>
          <h1 className="font-medium font-pp text-2xl text-foreground">
            Automation not found
          </h1>
          <p className="max-w-md text-muted-foreground text-sm leading-6">
            It may have been removed or belongs to another organization.
          </p>
          <Button
            className="gap-2"
            onClick={() => void automationQuery.refetch()}
            size="lf"
            type="button"
            variant="secondary"
          >
            <HugeiconsIcon className="size-4" icon={RefreshCcw} />
            Refresh
          </Button>
        </section>
      </div>
    );
  }

  const automation = automationQuery.data;

  return (
    <div className="grid grid-cols-1 lg:h-full lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 px-8 py-10 lg:min-h-0 lg:overflow-y-auto lg:px-12 lg:py-12">
        <div className="mb-6">
          <AutomationDetailNav slug={slug} />
        </div>
        <AutomationNameEditor automation={automation} />
        <div className="mt-6">
          <AutomationPromptEditor automation={automation} />
        </div>
      </div>

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
            <span className="text-foreground text-sm">
              {formatConnectorProvider(automation.connectorProvider)}
            </span>
          </RailRow>
        </RailSection>

        <AutomationActions automation={automation} slug={slug} />

        <RailSection title="Previous runs">
          <AutomationRunsSection
            automationId={automationId}
            selectedRunId={selectedRunId}
            setSelectedRunId={setSelectedRunId}
          />
        </RailSection>
      </div>
    </div>
  );
}

function AutomationDetailSkeleton({ slug }: { slug: string }) {
  return (
    <div className="grid grid-cols-1 lg:h-full lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6 px-8 py-10 lg:px-12 lg:py-12">
        <AutomationDetailNav slug={slug} />
        <div className="h-9 w-72 animate-pulse rounded bg-muted" />
        <div className="space-y-3">
          <div className="h-4 w-full max-w-3xl animate-pulse rounded bg-muted" />
          <div className="h-4 w-5/6 max-w-3xl animate-pulse rounded bg-muted" />
          <div className="h-4 w-2/3 max-w-3xl animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="space-y-8 px-6 py-10 lg:border-border lg:border-l lg:px-8 lg:py-12">
        <div className="space-y-3">
          <div className="h-3 w-16 animate-pulse rounded bg-muted" />
          <div className="h-7 w-full animate-pulse rounded bg-muted" />
          <div className="h-7 w-full animate-pulse rounded bg-muted" />
        </div>
        <div className="space-y-3">
          <div className="h-3 w-16 animate-pulse rounded bg-muted" />
          <div className="h-7 w-full animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

function AutomationDetailNav({ slug }: { slug: string }) {
  return (
    <div className="flex items-center gap-2">
      <SidebarTrigger className="size-6 rounded-lg border border-border/70 bg-muted/30 p-0 text-muted-foreground hover:bg-muted/60 hover:text-foreground md:hidden" />
      <Button
        asChild
        className="-ml-1 h-6 gap-1 rounded-lg px-2 font-normal text-muted-foreground text-sm hover:bg-muted/60 hover:text-foreground"
        size="sm"
        variant="ghost"
      >
        <Link params={{ slug }} preload="intent" to="/$slug/automations">
          <HugeiconsIcon className="size-3" icon={ChevronLeft} />
          Automations
        </Link>
      </Button>
    </div>
  );
}
