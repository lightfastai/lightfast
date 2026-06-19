import {
  ChevronDownIcon as ChevronDown,
  Settings02Icon as Settings,
  Unlink02Icon as Unplug,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui-v2/components/ui/dropdown-menu";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { GitHubUserAccount } from "../account-cache";

const DISCONNECT_TOOLTIP = "Connection is managed from the GitHub setup task.";

const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatConnectedAt(value: Date): string | null {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return null;
  }
  return `Connected on ${shortDateFormatter.format(value)}`;
}

function IconTile({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[9px] border border-border bg-transparent text-foreground">
      {children}
    </span>
  );
}

export function GithubAccountCard({ account }: { account: GitHubUserAccount }) {
  const subtitle = formatConnectedAt(account.connectedAt);

  return (
    <section className="rounded-[12px] border border-border bg-background">
      <div className="flex items-center justify-between gap-4 p-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <IconTile>
            <Icons.github
              aria-hidden="true"
              className="size-4 text-foreground"
            />
          </IconTile>
          <div className="min-w-0">
            <p className="truncate text-foreground text-sm">
              {account.provider}:{account.providerUserId}
            </p>
            {subtitle ? (
              <p className="text-muted-foreground text-xs">{subtitle}</p>
            ) : null}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                className="h-7 shrink-0 justify-between gap-1.5 rounded-[9px] border border-input bg-card px-2.5 font-normal text-foreground text-sm hover:bg-accent"
                size="sm"
                type="button"
                variant="ghost"
              />
            }
          >
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-emerald-500"
              />
              <span className="truncate">Connected</span>
            </span>
            <HugeiconsIcon
              aria-hidden="true"
              className="size-3.5 shrink-0 text-muted-foreground"
              icon={ChevronDown}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              className="gap-2"
              render={
                <Link
                  preload="intent"
                  search={{ github_error: undefined }}
                  to="/account/tasks/github"
                />
              }
            >
              <HugeiconsIcon
                aria-hidden="true"
                className="size-4"
                icon={Settings}
              />
              <span className="min-w-0 flex-1 truncate">View GitHub setup</span>
            </DropdownMenuItem>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <DropdownMenuItem
                    className="gap-2"
                    disabled
                    variant="destructive"
                  >
                    <HugeiconsIcon
                      aria-hidden="true"
                      className="size-4"
                      icon={Unplug}
                    />
                    <span className="min-w-0 flex-1 truncate">Disconnect</span>
                  </DropdownMenuItem>
                </div>
              </TooltipTrigger>
              <TooltipContent>{DISCONNECT_TOOLTIP}</TooltipContent>
            </Tooltip>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </section>
  );
}
