import { useAuth } from "@clerk/tanstack-react-start";
import {
  CircleIcon as Circle,
  PauseCircleIcon as CirclePause,
  Loading03Icon as Loader2,
  Add01Icon as Plus,
  ReloadIcon as RefreshCcw,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { formatAutomationSchedule } from "@repo/app-validation/schemas";
import { Button } from "@repo/ui/components/ui/button";
import { SidebarTrigger } from "@repo/ui-v2/components/ui/sidebar";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { WorkspaceSurface } from "~/components/workspace-surface";
import {
  type AutomationListItem,
  getAutomationSections,
  hasAutomations,
} from "./automations-model";
import { automationsListQueryOptions } from "./automations-queries";

export function AutomationsClient({ slug }: { slug: string }) {
  const { has, isLoaded } = useAuth();
  const canManageAutomations = isLoaded && !!has?.({ role: "org:admin" });
  const automationsQuery = useQuery(
    automationsListQueryOptions({
      enabled: typeof window !== "undefined",
      staleTime: 30_000,
    })
  );
  const automations = automationsQuery.data ?? [];
  const sections = getAutomationSections(automations);

  return (
    <WorkspaceSurface className="max-w-4xl py-10">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="size-8 rounded-lg border border-border/70 bg-muted/30 p-0 text-muted-foreground hover:bg-muted/60 hover:text-foreground md:hidden" />
            <h1 className="font-semibold text-2xl text-foreground tracking-[-0.02em]">
              Automations
            </h1>
          </div>
          <p className="mt-1 text-muted-foreground text-sm">
            Cloud schedules that record scaffold runs.
          </p>
        </div>
        {canManageAutomations ? (
          <Button asChild size="lf" variant="secondary">
            <Link params={{ slug }} to="/$slug/automations/new">
              <HugeiconsIcon className="size-4" icon={Plus} />
              New automation
            </Link>
          </Button>
        ) : null}
      </div>

      {automationsQuery.isPending ? (
        <div className="mt-10 flex items-center gap-2 border-border border-t pt-6 text-muted-foreground text-sm">
          <HugeiconsIcon className="size-4 animate-spin" icon={Loader2} />
          Loading automations
        </div>
      ) : automationsQuery.isError ? (
        <div className="mt-10 border-border border-t pt-6">
          <p className="text-foreground text-sm">Unable to load automations</p>
          <p className="mt-1 text-muted-foreground text-sm">
            Refresh the list to try again.
          </p>
          <Button
            className="mt-4 gap-2"
            onClick={() => void automationsQuery.refetch()}
            size="lf"
            type="button"
            variant="secondary"
          >
            <HugeiconsIcon className="size-4" icon={RefreshCcw} />
            Refresh
          </Button>
        </div>
      ) : hasAutomations(automations) ? (
        <div className="mt-10 space-y-10">
          {sections.map((section) => (
            <AutomationSection
              automations={section.automations}
              key={section.title}
              slug={slug}
              title={section.title}
            />
          ))}
        </div>
      ) : (
        <div className="mt-10 border-border border-t pt-6">
          <p className="text-foreground text-sm">No automations yet</p>
          <p className="mt-1 text-muted-foreground text-sm">
            Create a cloud schedule to start recording scaffold runs.
          </p>
        </div>
      )}
    </WorkspaceSurface>
  );
}

function AutomationSection({
  automations,
  slug,
  title,
}: {
  automations: AutomationListItem[];
  slug: string;
  title: string;
}) {
  return (
    <section>
      <h2 className="font-normal text-muted-foreground text-sm">{title}</h2>
      <div className="mt-3 space-y-1 rounded-2xl border border-border/60 p-2">
        {automations.map((automation) => (
          <AutomationRow
            automation={automation}
            key={automation.publicId}
            slug={slug}
          />
        ))}
      </div>
    </section>
  );
}

function AutomationRow({
  automation,
  slug,
}: {
  automation: AutomationListItem;
  slug: string;
}) {
  const isPaused = automation.status === "paused";
  const icon = isPaused ? CirclePause : Circle;

  return (
    <Link
      className="flex items-center justify-between gap-4 rounded-xl px-3 py-3 transition-colors hover:bg-muted/40"
      params={{ automation: automation.publicId, slug }}
      search={{ run: undefined }}
      to="/$slug/automations/$automation"
    >
      <div className="flex min-w-0 items-center gap-3">
        <HugeiconsIcon
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
          icon={icon}
          strokeWidth={2}
        />
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <p className="truncate font-medium text-foreground text-sm">
            {automation.name}
          </p>
        </div>
      </div>
      <p className="shrink-0 text-muted-foreground text-sm">
        {formatAutomationSchedule(automation)}
      </p>
    </Link>
  );
}
