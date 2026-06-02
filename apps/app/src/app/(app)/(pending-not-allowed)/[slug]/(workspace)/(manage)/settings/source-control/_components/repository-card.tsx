"use client";

import type { AppRouterOutputs } from "@api/app";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { cn } from "@repo/ui/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  GitBranch,
  MoreHorizontal,
} from "lucide-react";
import { useState } from "react";

type SourceControlRepositoryRow =
  AppRouterOutputs["org"]["settings"]["sourceControl"]["listRepositories"]["repositories"][number];

// Mirror of SOURCE_CONTROL_ALL_PATHS_GLOB from @repo/source-control-contract.
// Inlined to avoid adding a workspace dependency to the app for one literal.
const ALL_PATHS_GLOB = "**";

const SYNC_STATUS_LABEL: Record<
  SourceControlRepositoryRow["syncStatus"],
  string
> = {
  enabled: "Enabled",
  disabled: "Disabled",
};

function SyncStatusIndicator({
  status,
}: {
  status: SourceControlRepositoryRow["syncStatus"];
}) {
  const enabled = status === "enabled";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 text-[10px]",
        enabled
          ? "text-emerald-700 dark:text-emerald-300"
          : "text-muted-foreground"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 rounded-full",
          enabled ? "bg-emerald-500" : "bg-muted-foreground/50"
        )}
      />
      {SYNC_STATUS_LABEL[status]}
    </span>
  );
}

function WatchedPaths({ globs }: { globs: string[] | null }) {
  if (globs === null) {
    return (
      <p className="text-[11px] text-muted-foreground">
        No watched paths configured
      </p>
    );
  }

  if (globs.includes(ALL_PATHS_GLOB)) {
    return (
      <p className="text-[11px] text-muted-foreground">Watching all paths</p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {globs.map((glob) => (
        <span
          className="inline-flex items-center rounded-[7px] border border-border px-2 py-1 text-[10px] text-muted-foreground"
          key={glob}
        >
          {glob}
        </span>
      ))}
    </div>
  );
}

export function RepositoryCard({
  repository,
}: {
  repository: SourceControlRepositoryRow;
}) {
  const [expanded, setExpanded] = useState(false);
  const watchedRegionId = `repository-${repository.id}-watched`;

  return (
    <div className="rounded-[12px] border border-border bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-[9px] border border-border bg-transparent">
            <GitBranch
              aria-hidden="true"
              className="size-3.5 text-foreground"
            />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-foreground text-sm">
                {repository.fullName}
              </p>
              <Badge
                className="rounded-[7px] px-1.5 py-0 text-[10px]"
                variant="outline"
              >
                {repository.private ? "Private" : "Public"}
              </Badge>
              <SyncStatusIndicator status={repository.syncStatus} />
            </div>
            <button
              aria-controls={watchedRegionId}
              aria-expanded={expanded}
              className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded((value) => !value)}
              type="button"
            >
              {expanded ? (
                <ChevronDown aria-hidden="true" className="size-3" />
              ) : (
                <ChevronRight aria-hidden="true" className="size-3" />
              )}
              Watched paths
            </button>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={`Repository actions for ${repository.fullName}`}
              className="h-6 w-6 rounded-full"
              size="sm"
              type="button"
              variant="ghost"
            >
              <MoreHorizontal
                aria-hidden="true"
                className="size-3.5 opacity-50"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <a
                href={`https://github.com/${repository.fullName}`}
                rel="noreferrer"
                target="_blank"
              >
                Open on GitHub
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {expanded ? (
        <div
          className="mt-3 rounded-[8px] border border-border bg-card/60 p-3"
          id={watchedRegionId}
        >
          <WatchedPaths globs={repository.watchedPathGlobs} />
        </div>
      ) : null}
    </div>
  );
}
