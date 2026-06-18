import {
  ChevronDownIcon as ChevronDown,
  ExternalLinkIcon as ExternalLink,
  Settings02Icon as Settings,
  Unlink02Icon as Unplug,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { LIGHTFAST_REPOSITORY_NAME } from "@repo/app-setup-contract";
import { Icons } from "@repo/ui/components/icons";
import { Badge } from "@repo/ui/components/ui/badge";
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
import { displayValue, formatStatusSubtitle } from "./source-control-format";
import type { SourceControlConnection } from "./source-control-queries";

const IMMUTABLE_CONNECTION_TOOLTIP =
  "Connection is set up once and can't be disconnected.";

function IconTile({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[9px] border border-border bg-transparent text-foreground">
      {children}
    </span>
  );
}

function ImmutableConnectionMenuItem({
  icon,
  label,
  variant,
}: {
  icon: ReactNode;
  label: string;
  variant?: "default" | "destructive";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>
          <DropdownMenuItem className="gap-2" disabled variant={variant}>
            {icon}
            <span className="min-w-0 flex-1 truncate">{label}</span>
          </DropdownMenuItem>
        </div>
      </TooltipTrigger>
      <TooltipContent>{IMMUTABLE_CONNECTION_TOOLTIP}</TooltipContent>
    </Tooltip>
  );
}

function LightfastSection({
  connection,
  orgSlug,
}: {
  connection: SourceControlConnection;
  orgSlug: string;
}) {
  const repository = connection.lightfastRepository;
  const name = repository
    ? repository.fullName
    : `${connection.accountLogin ?? "workspace"}/${LIGHTFAST_REPOSITORY_NAME}`;
  const description = repository
    ? "Coordinates workspace automation."
    : `Create and verify the ${LIGHTFAST_REPOSITORY_NAME} repository to unlock workspace automation.`;
  const subtitle = repository
    ? formatStatusSubtitle("Verified", repository.verifiedAt)
    : null;

  return (
    <div className="flex items-center justify-between gap-4 p-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <IconTile>
          <Icons.logoShort
            aria-hidden="true"
            className="size-4 text-foreground"
          />
        </IconTile>
        <div className="min-w-0">
          <p className="truncate text-foreground text-sm">{name}</p>
          <p className="text-muted-foreground text-xs">
            {subtitle ?? description}
          </p>
        </div>
      </div>

      {repository ? (
        <Badge
          className="shrink-0 gap-1.5 border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          variant="outline"
        >
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full bg-current"
          />
          Verified
        </Badge>
      ) : (
        <Button
          asChild
          className="h-7 rounded-[9px]"
          size="sm"
          variant="outline"
        >
          <Link
            params={{ slug: orgSlug }}
            preload="intent"
            to="/$slug/tasks/github/lightfast-repo"
          >
            <HugeiconsIcon
              aria-hidden="true"
              className="size-3.5"
              icon={ExternalLink}
            />
            Open setup
          </Link>
        </Button>
      )}
    </div>
  );
}

export function SourceControlConnectionCard({
  connection,
  orgSlug,
}: {
  connection: SourceControlConnection;
  orgSlug: string;
}) {
  const subtitle = formatStatusSubtitle("Connected on", connection.connectedAt);

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
              {displayValue(connection.accountLogin)}
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
                aria-label="Connection status"
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
            <ImmutableConnectionMenuItem
              icon={
                <HugeiconsIcon
                  aria-hidden="true"
                  className="size-4"
                  icon={Settings}
                />
              }
              label="Configure in GitHub"
            />
            <ImmutableConnectionMenuItem
              icon={
                <HugeiconsIcon
                  aria-hidden="true"
                  className="size-4"
                  icon={Unplug}
                />
              }
              label="Disconnect"
              variant="destructive"
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="h-px bg-border" />

      <LightfastSection connection={connection} orgSlug={orgSlug} />
    </section>
  );
}
