"use client";

import type { AppRouterOutputs } from "@api/app";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { ChevronDown, Settings, Unplug } from "lucide-react";
import Link from "next/link";

type GithubUserAccount = NonNullable<
  AppRouterOutputs["viewer"]["githubAccount"]["status"]["account"]
>;

const GITHUB_ACCOUNT_TASK_HREF = "/account/tasks/github";
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

export function GithubAccountCard({ account }: { account: GithubUserAccount }) {
  const subtitle = formatConnectedAt(account.connectedAt);

  return (
    <section className="flex items-center justify-between gap-4 rounded-[8px] border border-border bg-background p-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[8px] border border-input bg-background">
          <Icons.github aria-hidden="true" className="size-4 text-foreground" />
        </div>
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
        <DropdownMenuTrigger asChild>
          <Button
            className="h-7 rounded-[9px]"
            size="sm"
            type="button"
            variant="outline"
          >
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-emerald-500"
            />
            Connected
            <ChevronDown aria-hidden="true" className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem asChild>
            <Link href={{ pathname: GITHUB_ACCOUNT_TASK_HREF }} prefetch={true}>
              <Settings aria-hidden="true" className="size-4" />
              View GitHub setup
            </Link>
          </DropdownMenuItem>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <DropdownMenuItem disabled variant="destructive">
                  <Unplug aria-hidden="true" className="size-4" />
                  Disconnect
                </DropdownMenuItem>
              </div>
            </TooltipTrigger>
            <TooltipContent>{DISCONNECT_TOOLTIP}</TooltipContent>
          </Tooltip>
        </DropdownMenuContent>
      </DropdownMenu>
    </section>
  );
}
