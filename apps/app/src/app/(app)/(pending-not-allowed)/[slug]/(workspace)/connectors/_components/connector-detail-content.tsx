"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { formatRelativeTimeToNow } from "@vendor/lib/time";
import {
  Activity,
  Bot,
  Building2,
  CalendarDays,
  Link2,
  MessageCircle,
  RefreshCcw,
  User,
  Workflow,
} from "lucide-react";
import type { ReactNode } from "react";
import { ConnectorIcon } from "./connector-icons";
import {
  type ConnectorCatalogRow,
  connectionStatus,
  isUserConnectorConnection,
  userConnectionStatus,
} from "./connectors-model";

const USER_CONNECTOR_AVAILABILITY_COPY =
  "Available in your chats. Not visible to teammates.";

function PropertyRow({
  children,
  icon,
  label,
}: {
  children: ReactNode;
  icon: ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="flex w-36 shrink-0 items-center gap-2.5 text-muted-foreground text-sm">
        {icon}
        {label}
      </span>
      <div className="min-w-0 flex-1 text-foreground text-sm">{children}</div>
    </div>
  );
}

function ToolRow({
  tool,
  trailing,
}: {
  tool: { description?: string; name: string };
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 border-border/60 border-t py-2.5 first:border-t-0">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-foreground text-sm">{tool.name}</p>
        {tool.description ? (
          <p className="mt-0.5 text-muted-foreground text-xs leading-relaxed">
            {tool.description}
          </p>
        ) : null}
      </div>
      {trailing}
    </div>
  );
}

export function ConnectorDetailContent({
  closeSlot,
  onCopyLink,
  row,
}: {
  closeSlot?: ReactNode;
  onCopyLink: () => void;
  row: ConnectorCatalogRow;
}) {
  const connection = row.connection;
  if (!connection) {
    return null;
  }

  const iconClass = "size-4 shrink-0";
  const connectedAt = new Date(connection.connectedAt);
  const lastRefreshAt = connection.lastToolRefreshAt
    ? new Date(connection.lastToolRefreshAt)
    : null;
  const hasRefreshError = Boolean(connection.lastToolRefreshErrorAt);
  const isUserConnection = isUserConnectorConnection(connection);
  const status = isUserConnection
    ? userConnectionStatus(connection)
    : connectionStatus(connection);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2.5 px-5 pt-5">
        <ConnectorIcon
          className="size-7 rounded-[7px]"
          provider={row.provider}
        />
        <div className="ml-auto flex items-center gap-1">
          <Button
            aria-label="Copy link"
            className="size-7 rounded-full text-muted-foreground hover:text-foreground"
            onClick={onCopyLink}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <Link2 aria-hidden="true" className="size-4" />
          </Button>
          {closeSlot}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        <h2 className="pt-4 pb-1 font-semibold text-2xl text-foreground leading-tight tracking-tight">
          {row.displayName}
        </h2>
        <p className="pb-5 text-muted-foreground text-sm">{row.description}</p>

        <div className="flex flex-col">
          <PropertyRow icon={<Activity className={iconClass} />} label="Status">
            <span className="inline-flex items-center gap-1.5">
              <span className={cn("size-1.5 rounded-full", status.dotClass)} />
              {status.label}
            </span>
          </PropertyRow>
          {isUserConnection ? (
            <>
              <PropertyRow
                icon={<MessageCircle className={iconClass} />}
                label="Availability"
              >
                <div className="flex flex-col items-start gap-1">
                  <Badge className="text-muted-foreground" variant="outline">
                    Only you
                  </Badge>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {USER_CONNECTOR_AVAILABILITY_COPY}
                  </p>
                </div>
              </PropertyRow>
              {connection.providerAccountName ? (
                <PropertyRow
                  icon={<User className={iconClass} />}
                  label="Account"
                >
                  {connection.providerAccountName}
                </PropertyRow>
              ) : null}
            </>
          ) : (
            <>
              {connection.providerWorkspaceName ? (
                <PropertyRow
                  icon={<Building2 className={iconClass} />}
                  label="Workspace"
                >
                  {connection.providerWorkspaceName}
                </PropertyRow>
              ) : null}
              {connection.providerActorName ? (
                <PropertyRow
                  icon={<User className={iconClass} />}
                  label="Account"
                >
                  {connection.providerActorName}
                </PropertyRow>
              ) : null}
            </>
          )}
          <PropertyRow
            icon={<CalendarDays className={iconClass} />}
            label="Connected"
          >
            <span title={connectedAt.toISOString()}>
              {formatRelativeTimeToNow(connectedAt, { addSuffix: true })}
            </span>
          </PropertyRow>
          {isUserConnection ? null : (
            <>
              <PropertyRow
                icon={<Workflow className={iconClass} />}
                label="Automations"
              >
                <Badge className="text-muted-foreground" variant="outline">
                  {connection.enabledForAutomations ? "Enabled" : "Disabled"}
                </Badge>
              </PropertyRow>
              <PropertyRow icon={<Bot className={iconClass} />} label="Agents">
                <Badge className="text-muted-foreground" variant="outline">
                  {connection.enabledForAgents ? "Enabled" : "Disabled"}
                </Badge>
              </PropertyRow>
            </>
          )}
          {lastRefreshAt ? (
            <PropertyRow
              icon={<RefreshCcw className={iconClass} />}
              label="Tools refreshed"
            >
              {hasRefreshError ? (
                <span className="text-amber-600">
                  {connection.lastToolRefreshErrorCode ?? "Refresh failed"}
                </span>
              ) : (
                <span title={lastRefreshAt.toISOString()}>
                  {formatRelativeTimeToNow(lastRefreshAt, { addSuffix: true })}
                </span>
              )}
            </PropertyRow>
          ) : null}
        </div>

        <div className="my-6 border-border/60 border-t" />

        <div className="flex items-center gap-2">
          <h3 className="font-medium text-foreground text-sm">Tools</h3>
          <Badge className="px-1.5 text-muted-foreground" variant="secondary">
            {connection.tools.length}
          </Badge>
        </div>
        {connection.tools.length > 0 ? (
          <div className="mt-2 flex flex-col">
            {isUserConnection
              ? connection.tools.map((tool) => (
                  <ToolRow key={tool.name} tool={tool} />
                ))
              : connection.tools.map((tool) => (
                  <ToolRow
                    key={tool.name}
                    tool={tool}
                    trailing={
                      <>
                        {tool.availableForAgents ? (
                          <span
                            aria-label="Available for agents"
                            className="mt-1.5 size-1.5 shrink-0 rounded-full bg-sky-500"
                            role="img"
                            title="Available for agents"
                          />
                        ) : null}
                        {tool.availableForAutomations ? (
                          <span
                            aria-label="Available for automations"
                            className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-500"
                            role="img"
                            title="Available for automations"
                          />
                        ) : null}
                      </>
                    }
                  />
                ))}
          </div>
        ) : (
          <p className="mt-3 rounded-[8px] border border-dashed border-border px-3 py-2 text-muted-foreground text-sm">
            No tools available yet.
          </p>
        )}
      </div>

      <div className="border-border/60 border-t px-5 py-3.5 text-muted-foreground text-xs">
        <span title={connectedAt.toISOString()}>
          Connected {formatRelativeTimeToNow(connectedAt, { addSuffix: true })}
        </span>
        {lastRefreshAt && !hasRefreshError ? (
          <>
            <span aria-hidden="true"> · </span>
            <span title={lastRefreshAt.toISOString()}>
              tools refreshed{" "}
              {formatRelativeTimeToNow(lastRefreshAt, { addSuffix: true })}
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}
