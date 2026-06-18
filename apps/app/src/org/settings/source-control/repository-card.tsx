import {
  ChevronDownIcon as ChevronDown,
  ChevronRightIcon as ChevronRight,
  CornerDownRightIcon as CornerDownRight,
  GitBranchIcon as GitBranch,
  MoreHorizontalIcon as MoreHorizontal,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui-v2/components/ui/dropdown-menu";
import { type ReactNode, useState } from "react";
import type { SourceControlRepositoryRow } from "./source-control-queries";

const ALL_PATHS_GLOB = "**";

const SYNC_STATUS_LABEL: Record<
  SourceControlRepositoryRow["syncStatus"],
  string
> = {
  disabled: "Disabled",
  enabled: "Enabled",
};

type WatchedPathsSummary =
  | { kind: "all" }
  | { globs: string[]; kind: "list" }
  | { kind: "none" };

function summarizeWatchedPaths(globs: string[] | null): WatchedPathsSummary {
  if (globs === null) {
    return { kind: "none" };
  }
  if (globs.includes(ALL_PATHS_GLOB)) {
    return { kind: "all" };
  }
  return { globs, kind: "list" };
}

function watchedPathsLabel(summary: WatchedPathsSummary): string {
  if (summary.kind === "none") {
    return "No paths";
  }
  if (summary.kind === "all") {
    return "All paths";
  }
  const count = summary.globs.length;
  return `${count} path${count === 1 ? "" : "s"}`;
}

function IconTile({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[9px] border border-border bg-transparent text-foreground">
      {children}
    </span>
  );
}

function SyncStatusBadge({
  status,
}: {
  status: SourceControlRepositoryRow["syncStatus"];
}) {
  const enabled = status === "enabled";
  return (
    <Badge
      className={cn(
        "shrink-0 gap-1.5",
        enabled
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-border bg-muted/40 text-muted-foreground"
      )}
      variant="outline"
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {SYNC_STATUS_LABEL[status]}
    </Badge>
  );
}

function WatchedPathsTree({ summary }: { summary: WatchedPathsSummary }) {
  if (summary.kind === "list") {
    return (
      <>
        {summary.globs.map((glob) => (
          <li
            className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground"
            key={glob}
          >
            <HugeiconsIcon
              aria-hidden="true"
              className="size-3 opacity-50"
              icon={CornerDownRight}
            />
            {glob}
          </li>
        ))}
      </>
    );
  }

  return (
    <li className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <HugeiconsIcon
        aria-hidden="true"
        className="size-3 opacity-50"
        icon={CornerDownRight}
      />
      {summary.kind === "all" ? "Watching all paths" : "No paths watched"}
    </li>
  );
}

export function RepositoryCard({
  repository,
}: {
  repository: SourceControlRepositoryRow;
}) {
  const [expanded, setExpanded] = useState(false);
  const watchedRegionId = `repository-${repository.id}-watched`;
  const summary = summarizeWatchedPaths(repository.watchedPathGlobs);

  return (
    <div className="p-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <IconTile>
            <HugeiconsIcon
              aria-hidden="true"
              className="size-4 text-foreground"
              icon={GitBranch}
            />
          </IconTile>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-foreground text-sm">
                {repository.fullName}
              </p>
              <Badge
                className="shrink-0 rounded-[7px] px-1.5 py-0 text-[10px] text-muted-foreground"
                variant="outline"
              >
                {repository.private ? "Private" : "Public"}
              </Badge>
            </div>
            <button
              aria-controls={watchedRegionId}
              aria-expanded={expanded}
              className="mt-0.5 inline-flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
              onClick={() => setExpanded((value) => !value)}
              type="button"
            >
              {expanded ? (
                <HugeiconsIcon
                  aria-hidden="true"
                  className="size-3"
                  icon={ChevronDown}
                />
              ) : (
                <HugeiconsIcon
                  aria-hidden="true"
                  className="size-3"
                  icon={ChevronRight}
                />
              )}
              {watchedPathsLabel(summary)}
            </button>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <SyncStatusBadge status={repository.syncStatus} />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label={`Repository actions for ${repository.fullName}`}
                  className="size-7 rounded-[9px]"
                  size="sm"
                  type="button"
                  variant="ghost"
                />
              }
            >
              <HugeiconsIcon
                aria-hidden="true"
                className="size-3.5 text-muted-foreground"
                icon={MoreHorizontal}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                render={
                  <a
                    aria-label={`Open ${repository.fullName} on GitHub`}
                    href={repository.webUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open on GitHub
                  </a>
                }
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {expanded ? (
        <ul className="mt-2 space-y-1 pl-[46px]" id={watchedRegionId}>
          <WatchedPathsTree summary={summary} />
        </ul>
      ) : null}
    </div>
  );
}
