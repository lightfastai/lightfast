"use client";

import type { AppRouterOutputs } from "@api/app";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { useSuspenseQuery } from "@tanstack/react-query";
import { formatRelativeTimeToNow } from "@vendor/lib/time";
import {
  Circle,
  CircleCheck,
  CircleDashed,
  CircleX,
  Search,
} from "lucide-react";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { useDeferredValue, useMemo } from "react";
import { WorkspaceSurface } from "~/components/workspace-surface";
import { useTRPC } from "~/trpc/react";

type SignalList = AppRouterOutputs["org"]["workspace"]["signals"]["list"];
type SignalRow = SignalList["items"][number];
type SignalStatus = SignalRow["status"];

const statusFilterValues = [
  "all",
  "queued",
  "processing",
  "classified",
  "failed",
] as const;
type SignalStatusFilter = (typeof statusFilterValues)[number];

const statusTabs: { label: string; value: SignalStatusFilter }[] = [
  { label: "All", value: "all" },
  { label: "Queued", value: "queued" },
  { label: "Processing", value: "processing" },
  { label: "Classified", value: "classified" },
  { label: "Failed", value: "failed" },
];

export function SignalsClient() {
  const trpc = useTRPC();
  const [query, setQuery] = useQueryState("q", parseAsString.withDefault(""));
  const [statusFilter, setStatusFilter] = useQueryState(
    "status",
    parseAsStringLiteral(statusFilterValues).withDefault("all")
  );
  const deferredQuery = useDeferredValue(query);
  const listQueryOptions = trpc.org.workspace.signals.list.queryOptions({
    limit: 50,
    search: deferredQuery.trim() || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
  });
  const { data } = useSuspenseQuery({
    ...listQueryOptions,
    staleTime: 30_000,
  });

  const rows = useMemo(() => data.items, [data.items]);

  return (
    <WorkspaceSurface variant="flush">
      <div className="flex h-11 items-center justify-between border-border border-t border-b px-4">
        <div>
          <h1 className="font-medium text-foreground text-sm">Signals</h1>
          <p className="text-muted-foreground text-xs">
            {data.items.length} recent signals
          </p>
        </div>
      </div>
      <div className="flex h-10 items-center gap-1 border-border border-b px-3">
        {statusTabs.map((tab) => (
          <Button
            aria-pressed={statusFilter === tab.value}
            key={tab.value}
            onClick={() => void setStatusFilter(tab.value)}
            size="sm"
            type="button"
            variant={statusFilter === tab.value ? "secondary" : "ghost"}
          >
            {tab.label}
          </Button>
        ))}
        <div className="ml-auto flex w-64 items-center gap-2">
          <Search className="size-3.5 text-muted-foreground" />
          <Input
            aria-label="Search signals"
            className="h-8"
            onChange={(event) => void setQuery(event.currentTarget.value)}
            placeholder="Search signals"
            value={query}
          />
        </div>
      </div>
      {rows.length === 0 ? (
        <SignalsEmptyState
          hasFilters={!!deferredQuery.trim() || statusFilter !== "all"}
        />
      ) : (
        <div className="bg-background">
          {rows.map((signal) => (
            <SignalListRow key={signal.publicId} signal={signal} />
          ))}
        </div>
      )}
    </WorkspaceSurface>
  );
}

function SignalsEmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center border-border border-b px-6 text-center">
      <p className="font-medium text-sm">
        {hasFilters ? "No matching signals" : "No signals yet"}
      </p>
      <p className="mt-1 max-w-sm text-muted-foreground text-sm">
        {hasFilters
          ? "Try a different search or status filter."
          : "Signals created by API keys and automations will appear here."}
      </p>
    </div>
  );
}

function SignalListRow({ signal }: { signal: SignalRow }) {
  const classification = signal.classification;
  const title = classification?.title ?? signal.input;
  const summary = classification?.summary ?? signal.input;

  return (
    <div className="grid min-h-11 grid-cols-[2rem_minmax(0,1fr)_5.5rem_5.5rem_6rem_6rem] items-center gap-3 border-border/70 border-b px-4 hover:bg-muted/30">
      <StatusIcon status={signal.status} />
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground text-sm">{title}</p>
        <p className="truncate text-muted-foreground text-xs">{summary}</p>
        {signal.status === "failed" && signal.errorCode && (
          <p className="truncate text-destructive text-xs">
            {signal.errorCode}
            {signal.errorMessage ? `: ${signal.errorMessage}` : ""}
          </p>
        )}
      </div>
      <SignalBadge>{classification?.priority ?? signal.status}</SignalBadge>
      <SignalBadge>{classification?.kind ?? "unclassified"}</SignalBadge>
      <SignalBadge>{classification?.disposition ?? signal.status}</SignalBadge>
      <Tooltip>
        <TooltipTrigger className="truncate text-left text-muted-foreground text-xs">
          {formatRelativeTimeToNow(new Date(signal.createdAt), {
            addSuffix: true,
          })}
        </TooltipTrigger>
        <TooltipContent>{signal.createdAt.toISOString()}</TooltipContent>
      </Tooltip>
    </div>
  );
}

function StatusIcon({ status }: { status: SignalStatus }) {
  const className = "size-4 text-muted-foreground";
  if (status === "classified") {
    return <CircleCheck className={className} />;
  }
  if (status === "failed") {
    return <CircleX className="size-4 text-destructive" />;
  }
  if (status === "processing") {
    return <CircleDashed className={className} />;
  }
  return <Circle className={className} />;
}

function SignalBadge({ children }: { children: React.ReactNode }) {
  return (
    <Badge className="truncate rounded-full" variant="secondary">
      {children}
    </Badge>
  );
}
