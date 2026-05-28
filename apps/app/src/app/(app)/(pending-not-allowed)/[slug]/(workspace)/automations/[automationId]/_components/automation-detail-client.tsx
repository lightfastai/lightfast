"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { useTRPC } from "~/trpc/react";
import { AutomationActions } from "./automation-actions";
import { AutomationNameEditor } from "./automation-name-editor";
import { AutomationPromptEditor } from "./automation-prompt-editor";
import { AutomationRunsList } from "./automation-runs-list";
import { AutomationScheduleEditor } from "./automation-schedule-editor";
import { AutomationStatusChip } from "./automation-status-chip";

function getSlug(pathname: string) {
  return pathname.split("/").filter(Boolean)[0] ?? "workspace";
}

function formatDate(date: Date | null | undefined): string {
  if (!date) {
    return "—";
  }
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
  const slug = getSlug(usePathname());
  const trpc = useTRPC();

  const { data: automation } = useSuspenseQuery({
    ...trpc.org.workspace.automations.get.queryOptions({ id: automationId }),
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
          <AutomationPromptEditor automation={automation} />
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

          <AutomationActions automation={automation} />

          <Suspense
            fallback={
              <RailSection label="Previous runs">
                <p className="text-muted-foreground text-sm">Loading…</p>
              </RailSection>
            }
          >
            <AutomationRunsList automationId={automationId} />
          </Suspense>
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
