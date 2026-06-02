"use client";

import type { AppRouterOutputs } from "@api/app";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { useSuspenseQuery } from "@tanstack/react-query";
import { formatRelativeTimeToNow } from "@vendor/lib/time";
import {
  CheckCircle,
  Clock,
  Loader2,
  PanelRightOpen,
  X,
  XCircle,
} from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { useTRPC } from "~/trpc/react";

type Decision =
  AppRouterOutputs["org"]["workspace"]["decisions"]["list"][number];

const STATUS_META = {
  failed: {
    icon: XCircle,
    label: "Failed",
    tone: "text-destructive",
  },
  running: {
    icon: Loader2,
    label: "Running",
    tone: "animate-spin text-muted-foreground",
  },
  succeeded: {
    icon: CheckCircle,
    label: "Succeeded",
    tone: "text-emerald-500",
  },
} satisfies Record<
  Decision["status"],
  {
    icon: typeof CheckCircle;
    label: string;
    tone: string;
  }
>;

function displayProvider(provider: Decision["provider"]) {
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function formatCaller(decision: Decision) {
  if (decision.calledByKind === "automation") {
    return `Automation ${decision.calledById}`;
  }
  if (decision.calledByKind === "user") {
    return `User ${decision.calledByUserId ?? decision.calledById}`;
  }
  return `System ${decision.calledById}`;
}

function formatDuration(decision: Decision) {
  if (!decision.finishedAt) {
    return "Running";
  }

  const durationMs = Math.max(
    0,
    decision.finishedAt.getTime() - decision.startedAt.getTime()
  );
  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }
  if (durationMs < 60_000) {
    const seconds = durationMs / 1000;
    return `${seconds.toFixed(seconds < 10 ? 1 : 0).replace(/\.0$/, "")}s`;
  }
  const minutes = durationMs / 60_000;
  return `${minutes.toFixed(minutes < 10 ? 1 : 0).replace(/\.0$/, "")}m`;
}

function DetailField({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="min-w-0 border-border border-t py-3 first:border-t-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1 break-words text-foreground text-sm">{children}</dd>
    </div>
  );
}

function DetailCode({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
      {children}
    </code>
  );
}

function CaptureBadge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground text-xs">
      {children}
    </span>
  );
}

function DecisionDetailPanel({
  decision,
  onClose,
}: {
  decision: Decision | null;
  onClose: () => void;
}) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!decision) {
      return;
    }

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [decision, onClose]);

  if (!decision) {
    return null;
  }

  const status = STATUS_META[decision.status];
  const StatusIcon = status.icon;

  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label="Close decision details"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        type="button"
      />
      <aside
        aria-labelledby={titleId}
        aria-modal="true"
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-border border-l bg-background shadow-2xl"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4 border-border border-b px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-semibold text-foreground text-lg" id={titleId}>
              Decision details
            </h2>
            <p className="mt-1 truncate text-muted-foreground text-sm">
              {displayProvider(decision.provider)} /{" "}
              <span className="font-mono">{decision.providerToolName}</span>
            </p>
          </div>
          <Button
            aria-label="Close decision details"
            onClick={onClose}
            ref={closeButtonRef}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <X className="size-4" />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2">
          <dl>
            <DetailField label="Status">
              <span className="inline-flex items-center gap-1.5">
                <StatusIcon className={cn("size-4", status.tone)} />
                {status.label}
              </span>
            </DetailField>
            <DetailField label="Caller">{formatCaller(decision)}</DetailField>
            <DetailField label="Decision ID">
              <DetailCode>{decision.publicId}</DetailCode>
            </DetailField>
            <DetailField label="Routine">
              <DetailCode>{decision.routineName}</DetailCode>
            </DetailField>
            <DetailField label="Provider tool">
              <DetailCode>{decision.providerToolName}</DetailCode>
            </DetailField>
            <DetailField label="Connector connection">
              <DetailCode>{decision.connectorConnectionId}</DetailCode>
            </DetailField>
            {decision.providerWorkspaceId && (
              <DetailField label="Provider workspace">
                <DetailCode>{decision.providerWorkspaceId}</DetailCode>
              </DetailField>
            )}
            {decision.providerActorId && (
              <DetailField label="Provider actor">
                <DetailCode>{decision.providerActorId}</DetailCode>
              </DetailField>
            )}
            <DetailField label="Started">
              <DetailCode>{decision.startedAt.toISOString()}</DetailCode>
            </DetailField>
            <DetailField label="Finished">
              {decision.finishedAt ? (
                <DetailCode>{decision.finishedAt.toISOString()}</DetailCode>
              ) : (
                "Running"
              )}
            </DetailField>
            <DetailField label="Duration">
              {formatDuration(decision)}
            </DetailField>
            <DetailField label="Captured data">
              <div className="flex flex-wrap gap-1.5">
                {decision.inputRedacted && (
                  <CaptureBadge>Input captured</CaptureBadge>
                )}
                {decision.outputRedacted && (
                  <CaptureBadge>Output captured</CaptureBadge>
                )}
                {!(decision.inputRedacted || decision.outputRedacted) && (
                  <span className="text-muted-foreground">None</span>
                )}
              </div>
            </DetailField>
            {decision.errorCode && (
              <DetailField label="Error code">
                <DetailCode>{decision.errorCode}</DetailCode>
              </DetailField>
            )}
          </dl>
        </div>
      </aside>
    </div>
  );
}

function DecisionRow({
  decision,
  onSelect,
}: {
  decision: Decision;
  onSelect: (decision: Decision) => void;
}) {
  const status = STATUS_META[decision.status];
  const StatusIcon = status.icon;

  return (
    <li className="border-border border-t first:border-t-0">
      <div className="grid gap-3 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-foreground text-sm">
              {displayProvider(decision.provider)}
            </span>
            <span className="text-muted-foreground text-xs">/</span>
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground text-xs">
              {decision.providerToolName}
            </code>
            <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
              <StatusIcon className={cn("size-3.5", status.tone)} />
              {status.label}
            </span>
          </div>
          <p className="mt-1 truncate text-muted-foreground text-xs">
            {formatCaller(decision)}
          </p>
        </div>

        <div className="flex flex-col gap-1 text-left sm:items-end sm:text-right">
          <span className="text-muted-foreground text-xs">
            {formatRelativeTimeToNow(decision.startedAt, { addSuffix: true })}
          </span>
          <span className="text-foreground text-xs">
            {formatDuration(decision)}
          </span>
        </div>

        <Button
          aria-label={`View ${decision.providerToolName} decision`}
          className="self-start"
          onClick={() => onSelect(decision)}
          size="sm"
          type="button"
          variant="ghost"
        >
          <PanelRightOpen className="size-4" />
          <span className="hidden sm:inline">Details</span>
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5 px-3 pb-3 text-xs">
        {decision.inputRedacted && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
            Input captured
          </span>
        )}
        {decision.outputRedacted && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
            Output captured
          </span>
        )}
        {decision.errorCode && (
          <code className="rounded bg-destructive/10 px-1.5 py-0.5 font-mono text-destructive">
            {decision.errorCode}
          </code>
        )}
      </div>
    </li>
  );
}

export function DecisionsClient() {
  const trpc = useTRPC();
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(
    null
  );
  const { data: decisions } = useSuspenseQuery({
    ...trpc.org.workspace.decisions.list.queryOptions({ limit: 50 }),
    staleTime: 5000,
  });

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <header>
        <h1 className="font-semibold text-2xl text-foreground tracking-[-0.02em]">
          Decisions
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
          Review recent integration work Lightfast performed for this team.
        </p>
      </header>

      {decisions.length === 0 ? (
        <div className="mt-8 rounded-[10px] border border-border px-3 py-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Clock className="size-4" />
            No decisions have been recorded yet.
          </div>
        </div>
      ) : (
        <section className="mt-8 rounded-[10px] border border-border bg-background">
          <ul>
            {decisions.map((decision) => (
              <DecisionRow
                decision={decision}
                key={decision.publicId}
                onSelect={setSelectedDecision}
              />
            ))}
          </ul>
        </section>
      )}

      <DecisionDetailPanel
        decision={selectedDecision}
        onClose={() => setSelectedDecision(null)}
      />
    </div>
  );
}
