"use client";

import type { AppRouterOutputs } from "@api/app";
import { Button } from "@repo/ui/components/ui/button";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useAuth } from "@vendor/clerk";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Loader2,
  Play,
  Trash,
  XCircle,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTRPC } from "~/trpc/react";
import { AutomationNameEditor } from "./automation-name-editor";
import { AutomationScheduleEditor } from "./automation-schedule-editor";
import { AutomationStatusChip } from "./automation-status-chip";

type Automation = AppRouterOutputs["org"]["workspace"]["automations"]["get"];
type AutomationRun =
  AppRouterOutputs["org"]["workspace"]["automations"]["listRuns"][number];

const RUN_STATUS_ICONS: Record<
  AutomationRun["status"],
  { icon: React.ElementType; className: string }
> = {
  completed: { icon: CheckCircle, className: "text-emerald-500" },
  failed: { icon: XCircle, className: "text-destructive" },
  cancelled: { icon: XCircle, className: "text-destructive" },
  running: { icon: Loader2, className: "animate-spin text-muted-foreground" },
  pending: { icon: Clock, className: "text-muted-foreground" },
  skipped: { icon: Clock, className: "text-muted-foreground" },
};

function getSlug(pathname: string) {
  return pathname.split("/").filter(Boolean)[0] ?? "workspace";
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function AutomationDetailClient({
  automationId,
}: {
  automationId: string;
}) {
  const { has, isLoaded } = useAuth();
  const canManage = isLoaded && !!has?.({ role: "org:admin" });
  const slug = getSlug(usePathname());
  const trpc = useTRPC();

  const { data: automation } = useSuspenseQuery({
    ...trpc.org.workspace.automations.get.queryOptions({ id: automationId }),
    staleTime: 30_000,
  });

  const { data: runs } = useSuspenseQuery({
    ...trpc.org.workspace.automations.listRuns.queryOptions({
      id: automationId,
      limit: 20,
    }),
    staleTime: 30_000,
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <Link
        className="inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
        href={`/${slug}/automations` as Route}
      >
        <ArrowLeft className="size-4" />
        Back
      </Link>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_20rem]">
        {/* Left column */}
        <div className="space-y-4">
          <AutomationNameEditor automation={automation} />
          {/* replaced in Task 7 — AutomationPromptEditor */}
          <AutomationPromptPlaceholder prompt={automation.prompt} />
        </div>

        {/* Right rail */}
        <div className="space-y-6 lg:w-80">
          <AutomationStatusChip automation={automation} />

          <RailSection label="Next run">
            <p className="text-foreground text-sm">
              {formatDate(automation.nextRunAt)}
            </p>
          </RailSection>

          <RailSection label="Last ran">
            <p className="text-foreground text-sm">
              {formatDate(automation.lastRunAt)}
            </p>
          </RailSection>

          <AutomationScheduleEditor automation={automation} />

          <div className="space-y-2 border-border border-t pt-4">
            {/* replaced in Task 8 — wired run-now + delete */}
            <Button
              className="w-full justify-start gap-2"
              disabled={!canManage}
              size="sm"
              variant="secondary"
            >
              <Play className="size-4" />
              Run now
            </Button>
            <Button
              className="w-full justify-start gap-2"
              disabled={!canManage}
              size="sm"
              variant="secondary"
            >
              <Trash className="size-4" />
              Delete
            </Button>
          </div>

          <RailSection label="Previous runs">
            {runs.length === 0 ? (
              <p className="text-muted-foreground text-sm">No runs yet.</p>
            ) : (
              <div className="space-y-2">
                {runs.map((run) => (
                  <RunRow key={run.publicId} run={run} />
                ))}
                {/* replaced in Task 8 — load more */}
              </div>
            )}
          </RailSection>
        </div>
      </div>
    </div>
  );
}

function RailSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border border-t pt-4">
      <p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {label}
      </p>
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-foreground text-sm">{value}</span>
    </div>
  );
}

function RunRow({ run }: { run: AutomationRun }) {
  const { icon: Icon, className } = RUN_STATUS_ICONS[run.status];
  return (
    <div className="flex items-center gap-2">
      <Icon className={`size-3.5 shrink-0 ${className}`} />
      <span className="text-foreground text-sm capitalize">{run.status}</span>
      <span className="ml-auto text-muted-foreground text-xs capitalize">
        {run.trigger}
      </span>
    </div>
  );
}

// replaced in Task 7 — AutomationPromptEditor
function AutomationPromptPlaceholder({
  prompt,
}: {
  prompt: Automation["prompt"];
}) {
  return <p className="text-muted-foreground text-sm">{prompt}</p>;
}
