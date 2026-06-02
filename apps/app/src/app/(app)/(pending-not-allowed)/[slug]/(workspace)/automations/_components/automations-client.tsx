"use client";

import type { AppRouterOutputs } from "@api/app";
import { formatAutomationSchedule } from "@repo/app-validation/schemas";
import { Button } from "@repo/ui/components/ui/button";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useAuth } from "@vendor/clerk";
import { Circle, CirclePause, Plus } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTRPC } from "~/trpc/react";

type AutomationList =
  AppRouterOutputs["org"]["workspace"]["automations"]["list"];
type Automation = AutomationList[number];

function getWorkspaceSlug(pathname: string) {
  return pathname.split("/").filter(Boolean)[0] ?? "workspace";
}

export function AutomationsClient() {
  const { has, isLoaded } = useAuth();
  const canManageAutomations = isLoaded && !!has?.({ role: "org:admin" });
  const pathname = usePathname();
  const workspaceSlug = getWorkspaceSlug(pathname);
  const trpc = useTRPC();
  const listQueryOptions = trpc.org.workspace.automations.list.queryOptions();
  const { data: automations } = useSuspenseQuery({
    ...listQueryOptions,
    staleTime: 30_000,
  });

  const currentAutomations = automations.filter(
    (automation) => automation.status === "active"
  );
  const pausedAutomations = automations.filter(
    (automation) => automation.status === "paused"
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-semibold text-2xl text-foreground tracking-[-0.02em]">
            Automations
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Cloud schedules that record scaffold runs.
          </p>
        </div>
        {canManageAutomations && (
          <Button asChild size="lf" variant="secondary">
            <Link href={`/${workspaceSlug}/automations/new` as Route}>
              <Plus className="size-4" />
              New automation
            </Link>
          </Button>
        )}
      </div>

      {automations.length === 0 ? (
        <div className="mt-10 border-border border-t pt-6">
          <p className="text-foreground text-sm">No automations yet</p>
          <p className="mt-1 text-muted-foreground text-sm">
            Create a cloud schedule to start recording scaffold runs.
          </p>
        </div>
      ) : (
        <div className="mt-10 space-y-10">
          <AutomationSection
            automations={currentAutomations}
            title="Current"
            workspaceSlug={workspaceSlug}
          />
          {pausedAutomations.length > 0 && (
            <AutomationSection
              automations={pausedAutomations}
              title="Paused"
              workspaceSlug={workspaceSlug}
            />
          )}
        </div>
      )}
    </div>
  );
}

function AutomationSection({
  automations,
  title,
  workspaceSlug,
}: {
  automations: Automation[];
  title: string;
  workspaceSlug: string;
}) {
  if (automations.length === 0) {
    return null;
  }

  return (
    <section>
      <h2 className="font-normal text-muted-foreground text-sm">{title}</h2>
      {/* Each status group is its own bordered card. p-2 gives the gap between
          the card border and the rounded item rows inside it. */}
      <div className="mt-3 space-y-1 rounded-2xl border border-border/60 p-2">
        {automations.map((automation) => (
          <AutomationRow
            automation={automation}
            key={automation.publicId}
            workspaceSlug={workspaceSlug}
          />
        ))}
      </div>
    </section>
  );
}

function AutomationRow({
  automation,
  workspaceSlug,
}: {
  automation: Automation;
  workspaceSlug: string;
}) {
  const isPaused = automation.status === "paused";
  const Icon = isPaused ? CirclePause : Circle;

  return (
    <Link
      className="flex items-center justify-between gap-4 rounded-xl px-3 py-3 transition-colors hover:bg-muted/40"
      href={`/${workspaceSlug}/automations/${automation.publicId}` as Route}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Icon
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
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
