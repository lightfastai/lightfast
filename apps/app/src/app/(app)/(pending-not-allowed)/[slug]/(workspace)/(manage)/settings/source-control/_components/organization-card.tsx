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
import { displayValue, formatStatusSubtitle } from "./source-control-format";

type SourceControlConnection = NonNullable<
  AppRouterOutputs["org"]["settings"]["sourceControl"]["get"]["binding"]
>;

const DISCONNECT_TOOLTIP =
  "Connection is set up once and can't be disconnected.";

export function OrganizationCard({
  connection,
}: {
  connection: SourceControlConnection;
}) {
  const subtitle = formatStatusSubtitle("Connected on", connection.connectedAt);

  return (
    <section className="flex items-center justify-between gap-4 rounded-[8px] border border-border bg-background p-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[8px] border border-input bg-background">
          <Icons.github aria-hidden="true" className="size-4 text-foreground" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-foreground text-sm">
            {displayValue(connection.accountLogin)}
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
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <DropdownMenuItem disabled>
                  <Settings aria-hidden="true" className="size-4" />
                  Configure in GitHub
                </DropdownMenuItem>
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
