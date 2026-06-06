"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/ui/alert-dialog";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Input } from "@repo/ui/components/ui/input";
import { Switch } from "@repo/ui/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { cn } from "@repo/ui/lib/utils";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  ArrowUpRight,
  Loader2,
  MoreHorizontal,
  PanelRight,
  RefreshCcw,
  Search,
} from "lucide-react";
import { useQueryState } from "nuqs";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useTRPC } from "~/trpc/react";
import { LfSelect } from "../../_components/lf-select";
import { ConnectorDetailSheet } from "./connector-detail-sheet";
import { ConnectorIcon } from "./connector-icons";
import {
  type ConnectorCatalogRow,
  type ConnectorProvider,
  type TeamConnectorCatalogRow,
  type UserConnectorCatalogRow,
  connectionStatus,
  displayProviderName,
  userConnectionStatus,
} from "./connectors-model";

type StatusFilter = "all" | "connected" | "available" | "needs_reconnect";

interface ConnectorsClientProps {
  callbackConnector?: string;
  callbackError?: string;
}

const CONNECTABLE_PROVIDERS = new Set<TeamConnectorCatalogRow["provider"]>([
  "linear",
  "x",
]);
const ADMIN_REQUIRED_MESSAGE = "Admin access required to manage connectors";
const DISCONNECT_UNAVAILABLE_MESSAGE =
  "Disconnecting isn't available right now.";
const USER_CONNECTOR_AVAILABILITY_COPY =
  "Available in your chats. Not visible to teammates.";

function isConnectableProvider(
  provider: ConnectorProvider
): provider is TeamConnectorCatalogRow["provider"] {
  return CONNECTABLE_PROVIDERS.has(
    provider as TeamConnectorCatalogRow["provider"]
  );
}

function filterMatches(row: ConnectorCatalogRow, filter: StatusFilter) {
  switch (filter) {
    case "available":
      return !row.connection;
    case "connected":
      return !!row.connection;
    case "needs_reconnect":
      return row.connection?.status === "error";
    default:
      return true;
  }
}

function searchMatches(row: ConnectorCatalogRow, normalizedQuery: string) {
  return (
    normalizedQuery.length === 0 ||
    [row.displayName, row.description, row.category, row.provider].some(
      (value) => value.toLowerCase().includes(normalizedQuery)
    )
  );
}

function isTeamMutationDisabled(
  row: TeamConnectorCatalogRow,
  pending: boolean
) {
  return pending || !row.canManage || !isConnectableProvider(row.provider);
}

function isTeamConnectDisabled(
  row: TeamConnectorCatalogRow,
  pending: boolean
) {
  return (
    isTeamMutationDisabled(row, pending) ||
    row.connectAvailability.status !== "available"
  );
}

function missingConfigMessage(row: TeamConnectorCatalogRow) {
  if (row.provider === "x") {
    return "X OAuth credentials are not configured.";
  }
  return "Linear OAuth credentials are not configured.";
}

function missingConfigFallback(row: TeamConnectorCatalogRow) {
  return row.provider === "x" ? "X OAuth" : "Linear OAuth";
}

export function ConnectorsClient({
  callbackConnector,
  callbackError,
}: ConnectorsClientProps = {}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [selectedProvider, setSelectedProvider] = useQueryState("connector");
  const [, setErrorParam] = useQueryState("error");
  const listSectionsQueryOptions =
    trpc.org.workspace.connectors.listSections.queryOptions();
  const { data: connectorSections } = useSuspenseQuery({
    ...listSectionsQueryOptions,
    staleTime: 30_000,
  });
  const teamConnectors = connectorSections.teamConnectors;
  const yourConnectors = connectorSections.yourConnectors;
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [callbackState] = useState(() => ({
    connector: callbackConnector,
    error: callbackError,
  }));

  const invalidateList = () =>
    queryClient.invalidateQueries(
      trpc.org.workspace.connectors.listSections.queryFilter()
    );

  const startConnectMutation = useMutation(
    trpc.org.workspace.connectors.startConnect.mutationOptions({
      onSuccess: (result) => {
        window.location.href = result.authorizationUrl;
      },
    })
  );
  const userStartConnectMutation = useMutation(
    trpc.viewer.account.userConnectors.startConnect.mutationOptions({
      onSuccess: (result) => {
        window.location.href = result.authorizationUrl;
      },
    })
  );
  const refreshToolsMutation = useMutation(
    trpc.org.workspace.connectors.refreshTools.mutationOptions({
      onSuccess: invalidateList,
    })
  );
  const setAutomationEnabledMutation = useMutation(
    trpc.org.workspace.connectors.setAutomationEnabled.mutationOptions({
      onSuccess: invalidateList,
    })
  );
  const setAgentEnabledMutation = useMutation(
    trpc.org.workspace.connectors.setAgentEnabled.mutationOptions({
      onSuccess: invalidateList,
    })
  );
  const disconnectMutation = useMutation(
    trpc.org.workspace.connectors.disconnect.mutationOptions({
      onSuccess: invalidateList,
    })
  );
  const userDisconnectMutation = useMutation(
    trpc.viewer.account.userConnectors.disconnect.mutationOptions({
      onSuccess: invalidateList,
    })
  );

  useEffect(() => {
    if (!callbackState.error) {
      return;
    }
    // A failed connect has no connection to show: clear both params so the
    // sheet stays closed and the error banner does not re-trigger on refresh.
    void setSelectedProvider(null);
    void setErrorParam(null);
  }, [callbackState.error, setErrorParam, setSelectedProvider]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredTeamConnectors = useMemo(
    () =>
      teamConnectors.filter(
        (row) =>
          searchMatches(row, normalizedQuery) &&
          filterMatches(row, statusFilter)
      ),
    [teamConnectors, normalizedQuery, statusFilter]
  );
  const filteredYourConnectors = useMemo(
    () =>
      yourConnectors.filter(
        (row) =>
          searchMatches(row, normalizedQuery) &&
          filterMatches(row, statusFilter)
      ),
    [yourConnectors, normalizedQuery, statusFilter]
  );
  const hasFilteredConnectors =
    filteredTeamConnectors.length > 0 || filteredYourConnectors.length > 0;

  function connect(row: TeamConnectorCatalogRow) {
    if (isConnectableProvider(row.provider)) {
      startConnectMutation.mutate({ provider: row.provider });
    }
  }

  function connectUser(row: UserConnectorCatalogRow) {
    userStartConnectMutation.mutate({ provider: row.provider });
  }

  function refreshTools(row: TeamConnectorCatalogRow) {
    if (isConnectableProvider(row.provider)) {
      refreshToolsMutation.mutate({ provider: row.provider });
    }
  }

  function setAutomationEnabled(row: TeamConnectorCatalogRow, enabled: boolean) {
    if (isConnectableProvider(row.provider)) {
      setAutomationEnabledMutation.mutate({ enabled, provider: row.provider });
    }
  }

  function setAgentEnabled(row: TeamConnectorCatalogRow, enabled: boolean) {
    if (isConnectableProvider(row.provider)) {
      setAgentEnabledMutation.mutate({ enabled, provider: row.provider });
    }
  }

  function disconnect(row: TeamConnectorCatalogRow) {
    if (isConnectableProvider(row.provider)) {
      disconnectMutation.mutate({ provider: row.provider });
    }
  }

  function disconnectUser(row: UserConnectorCatalogRow) {
    userDisconnectMutation.mutate({ provider: row.provider });
  }

  function viewDetails(row: ConnectorCatalogRow) {
    void setSelectedProvider(row.provider);
  }

  // Never open the sheet on a failed callback (handled by the cleanup effect).
  const sheetProvider = callbackState.error ? null : selectedProvider;
  const allConnectors = [...teamConnectors, ...yourConnectors];
  const sheetRow = sheetProvider
    ? allConnectors.find(
        (row) => row.provider === sheetProvider && row.connection
      )
    : undefined;

  const mutationPending =
    startConnectMutation.isPending ||
    userStartConnectMutation.isPending ||
    refreshToolsMutation.isPending ||
    setAutomationEnabledMutation.isPending ||
    setAgentEnabledMutation.isPending ||
    disconnectMutation.isPending ||
    userDisconnectMutation.isPending;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <header>
        <h1 className="font-semibold text-2xl text-foreground tracking-[-0.02em]">
          Connectors
        </h1>
        <p className="mt-2 max-w-xl text-muted-foreground text-sm">
          Allow Lightfast to reference other apps for more context and actions
          through MCP connectors.
        </p>
      </header>

      {callbackState.error && (
        <div className="mt-6 rounded-[9px] border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm">
          <p className="font-medium text-destructive">
            {displayProviderName(callbackState.connector)} connection failed
          </p>
          <p className="mt-1 text-destructive/85">{callbackState.error}</p>
        </div>
      )}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search connectors"
            className="pl-8"
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search connectors"
            size="lf"
            value={query}
            variant="lf"
          />
        </div>
        <LfSelect
          align="end"
          aria-label="Status"
          className="shrink-0 sm:w-44"
          onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          options={[
            { label: "All statuses", value: "all" },
            { label: "Connected", value: "connected" },
            { label: "Available", value: "available" },
            { label: "Needs reconnect", value: "needs_reconnect" },
          ]}
          value={statusFilter}
        />
      </div>

      {!hasFilteredConnectors ? (
        <p className="mt-6 text-muted-foreground text-sm">
          No connectors match these filters.
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-7">
          <ConnectorSection
            description="Shared workspace connectors managed by admins."
            owner="team"
            title="Team connectors"
          >
            {filteredTeamConnectors.length > 0 ? (
              filteredTeamConnectors.map((row) =>
                row.connection ? (
                  <TeamConnectedConnectorCard
                    key={row.provider}
                    onConnect={connect}
                    onDisconnect={disconnect}
                    onRefreshTools={refreshTools}
                    onSetAgentEnabled={setAgentEnabled}
                    onSetAutomationEnabled={setAutomationEnabled}
                    onViewDetails={viewDetails}
                    pending={mutationPending}
                    refreshing={
                      refreshToolsMutation.isPending &&
                      refreshToolsMutation.variables?.provider === row.provider
                    }
                    row={row}
                  />
                ) : (
                  <TeamAvailableConnectorCard
                    key={row.provider}
                    onConnect={connect}
                    pending={mutationPending}
                    row={row}
                  />
                )
              )
            ) : (
              <SectionEmptyState />
            )}
          </ConnectorSection>

          <ConnectorSection
            description="Private connectors only you can use in chats."
            owner="user"
            title="Your connectors"
          >
            {filteredYourConnectors.length > 0 ? (
              filteredYourConnectors.map((row) =>
                row.connection ? (
                  <UserConnectedConnectorCard
                    key={row.provider}
                    onConnect={connectUser}
                    onDisconnect={disconnectUser}
                    onViewDetails={viewDetails}
                    pending={mutationPending}
                    row={row}
                  />
                ) : (
                  <UserAvailableConnectorCard
                    key={row.provider}
                    onConnect={connectUser}
                    pending={mutationPending}
                    row={row}
                  />
                )
              )
            ) : (
              <SectionEmptyState />
            )}
          </ConnectorSection>
        </div>
      )}

      <ConnectorDetailSheet
        onOpenChange={(open) => {
          if (!open) {
            void setSelectedProvider(null);
          }
        }}
        row={sheetRow}
      />
    </div>
  );
}

function ConnectorSection({
  children,
  description,
  owner,
  title,
}: {
  children: ReactNode;
  description: string;
  owner: "team" | "user";
  title: string;
}) {
  return (
    <section data-owner={owner}>
      <h2 className="font-medium text-foreground text-sm">{title}</h2>
      <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
        {description}
      </p>
      <div className="mt-3 flex flex-col gap-4">{children}</div>
    </section>
  );
}

function SectionEmptyState() {
  return (
    <p className="text-muted-foreground text-sm">
      No connectors match these filters.
    </p>
  );
}

function TeamConnectedConnectorCard({
  onConnect,
  onDisconnect,
  onRefreshTools,
  onSetAgentEnabled,
  onSetAutomationEnabled,
  onViewDetails,
  pending,
  refreshing,
  row,
}: {
  onConnect: (row: TeamConnectorCatalogRow) => void;
  onDisconnect: (row: TeamConnectorCatalogRow) => void;
  onRefreshTools: (row: TeamConnectorCatalogRow) => void;
  onSetAgentEnabled: (row: TeamConnectorCatalogRow, enabled: boolean) => void;
  onSetAutomationEnabled: (
    row: TeamConnectorCatalogRow,
    enabled: boolean
  ) => void;
  onViewDetails: (row: ConnectorCatalogRow) => void;
  pending: boolean;
  refreshing: boolean;
  row: TeamConnectorCatalogRow;
}) {
  const connection = row.connection;
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!connection) {
    return null;
  }

  const status = connectionStatus(connection);
  const actionDisabled = isTeamMutationDisabled(row, pending);
  const connectDisabled = isTeamConnectDisabled(row, pending);
  const showAdminRequired =
    !row.canManage && isConnectableProvider(row.provider);

  return (
    <section
      className="rounded-[12px] border border-border bg-background"
      data-owner="team"
      data-provider={row.provider}
    >
      <div className="flex items-center gap-3 p-3">
        <ConnectorIcon provider={row.provider} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="font-medium text-base text-foreground">
              {row.displayName}
            </h3>
            <Badge className="shrink-0" variant="outline">
              Team
            </Badge>
          </div>
          <p className="mt-0.5 text-muted-foreground text-sm">
            {row.description}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 text-foreground text-sm">
            <span className={cn("size-1.5 rounded-full", status.dotClass)} />
            {status.label}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label="Connector actions"
                className="h-6 w-6 rounded-full"
                size="sm"
                type="button"
                variant="ghost"
              >
                <MoreHorizontal className="size-3.5 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onViewDetails(row)}>
                <PanelRight className="size-3.5" />
                View details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={actionDisabled || refreshing}
                onSelect={() => onRefreshTools(row)}
              >
                {refreshing ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCcw className="size-3.5" />
                )}
                Refresh tools
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={connectDisabled}
                onSelect={() => onConnect(row)}
              >
                <ArrowUpRight className="size-3.5" />
                Reconnect
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuItem
                    aria-disabled={actionDisabled || undefined}
                    className={cn(
                      actionDisabled && "cursor-not-allowed opacity-50"
                    )}
                    onSelect={(event) => {
                      // Keep the menu open on select; a native `disabled` item
                      // suppresses hover, so we fake-disable to keep the tooltip.
                      event.preventDefault();
                      if (actionDisabled) {
                        return;
                      }
                      setConfirmOpen(true);
                    }}
                    variant="destructive"
                  >
                    Disconnect
                  </DropdownMenuItem>
                </TooltipTrigger>
                {actionDisabled ? (
                  <TooltipContent>
                    {DISCONNECT_UNAVAILABLE_MESSAGE}
                  </TooltipContent>
                ) : null}
              </Tooltip>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="h-px bg-border" />

      <div className="p-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground text-sm">Tools</span>
          <Badge className="px-1.5 text-muted-foreground" variant="secondary">
            {connection.tools.length}
          </Badge>
          {refreshing && (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {connection.tools.map((tool) => (
            <Badge
              className="font-normal"
              key={tool.name}
              title={tool.description}
              variant="secondary"
            >
              {tool.name}
            </Badge>
          ))}
        </div>
      </div>

      <div className="h-px bg-border" />

      <div className="flex items-center justify-between gap-6 p-3">
        <div className="min-w-0">
          <p className="text-foreground text-sm">Use in automations</p>
          <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
            Allow your data from {row.displayName} to be used inside automations
            created in Lightfast.
          </p>
        </div>
        <Switch
          aria-label="Use in automations"
          checked={connection.enabledForAutomations}
          disabled={actionDisabled}
          onCheckedChange={(enabled) => onSetAutomationEnabled(row, enabled)}
        />
      </div>

      <div className="h-px bg-border" />

      <div className="flex items-center justify-between gap-6 p-3">
        <div className="min-w-0">
          <p className="text-foreground text-sm">Use in agents</p>
          <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
            Allow agents to discover and call tools from {row.displayName}.
          </p>
        </div>
        <Switch
          aria-label="Use in agents"
          checked={connection.enabledForAgents}
          disabled={actionDisabled}
          onCheckedChange={(enabled) => onSetAgentEnabled(row, enabled)}
        />
      </div>

      {showAdminRequired && (
        <p className="px-3 pb-3 text-muted-foreground text-xs">
          {ADMIN_REQUIRED_MESSAGE}
        </p>
      )}

      <AlertDialog onOpenChange={setConfirmOpen} open={confirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {row.displayName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Lightfast will stop referencing this connector in automations
              until an admin reconnects it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => onDisconnect(row)}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function TeamAvailableConnectorCard({
  onConnect,
  pending,
  row,
}: {
  onConnect: (row: TeamConnectorCatalogRow) => void;
  pending: boolean;
  row: TeamConnectorCatalogRow;
}) {
  const connectDisabled = isTeamConnectDisabled(row, pending);
  const showAdminRequired =
    !row.canManage && isConnectableProvider(row.provider);
  const missingConfig =
    row.connectAvailability.status === "unavailable" &&
    row.connectAvailability.reason === "missing_config";

  return (
    <section
      className="rounded-[12px] border border-border bg-background"
      data-owner="team"
      data-provider={row.provider}
    >
      <div className="flex items-center gap-3 p-3">
        <ConnectorIcon provider={row.provider} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="font-medium text-base text-foreground">
              {row.displayName}
            </h3>
            <Badge className="shrink-0" variant="outline">
              Team
            </Badge>
          </div>
          <p className="mt-0.5 text-muted-foreground text-sm">
            {row.description}
          </p>
          {missingConfig && (
            <div className="mt-1 text-muted-foreground text-xs">
              <p>{missingConfigMessage(row)}</p>
              <p>
                Missing config:{" "}
                <span className="text-foreground">
                  {row.connectAvailability.status === "unavailable"
                    ? (row.connectAvailability.missing?.join(", ") ??
                      missingConfigFallback(row))
                    : missingConfigFallback(row)}
                </span>
              </p>
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Button
            disabled={connectDisabled}
            onClick={() => onConnect(row)}
            size="lf"
            type="button"
            variant="outline"
          >
            Connect
            <ArrowUpRight className="size-3.5" />
          </Button>
          {showAdminRequired && (
            <p className="text-muted-foreground text-xs">
              {ADMIN_REQUIRED_MESSAGE}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function UserConnectedConnectorCard({
  onConnect,
  onDisconnect,
  onViewDetails,
  pending,
  row,
}: {
  onConnect: (row: UserConnectorCatalogRow) => void;
  onDisconnect: (row: UserConnectorCatalogRow) => void;
  onViewDetails: (row: ConnectorCatalogRow) => void;
  pending: boolean;
  row: UserConnectorCatalogRow;
}) {
  const connection = row.connection;
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!connection) {
    return null;
  }

  const status = userConnectionStatus(connection);
  const actionDisabled = pending || !row.canManage;

  return (
    <section
      className="rounded-[12px] border border-border bg-background"
      data-owner="user"
      data-provider={row.provider}
    >
      <div className="flex items-center gap-3 p-3">
        <ConnectorIcon provider={row.provider} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="font-medium text-base text-foreground">
              {row.displayName}
            </h3>
            <Badge className="shrink-0" variant="secondary">
              Only you
            </Badge>
          </div>
          <p className="mt-0.5 text-muted-foreground text-sm">
            {row.description}
          </p>
          <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
            {USER_CONNECTOR_AVAILABILITY_COPY}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 text-foreground text-sm">
            <span className={cn("size-1.5 rounded-full", status.dotClass)} />
            {status.label}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label="Connector actions"
                className="h-6 w-6 rounded-full"
                size="sm"
                type="button"
                variant="ghost"
              >
                <MoreHorizontal className="size-3.5 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onViewDetails(row)}>
                <PanelRight className="size-3.5" />
                View details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={actionDisabled}
                onSelect={() => onConnect(row)}
              >
                <ArrowUpRight className="size-3.5" />
                Reconnect
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={actionDisabled}
                onSelect={() => setConfirmOpen(true)}
                variant="destructive"
              >
                Disconnect
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="h-px bg-border" />

      <div className="p-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground text-sm">Tools</span>
          <Badge className="px-1.5 text-muted-foreground" variant="secondary">
            {connection.tools.length}
          </Badge>
        </div>
        {connection.tools.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {connection.tools.map((tool) => (
              <Badge
                className="font-normal"
                key={tool.name}
                title={tool.description}
                variant="secondary"
              >
                {tool.name}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-[8px] border border-dashed border-border px-3 py-2 text-muted-foreground text-sm">
            No tools available yet.
          </p>
        )}
      </div>

      <AlertDialog onOpenChange={setConfirmOpen} open={confirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {row.displayName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Lightfast will stop making this connector available in your chats.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => onDisconnect(row)}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function UserAvailableConnectorCard({
  onConnect,
  pending,
  row,
}: {
  onConnect: (row: UserConnectorCatalogRow) => void;
  pending: boolean;
  row: UserConnectorCatalogRow;
}) {
  const connectDisabled =
    pending || !row.canManage || row.connectAvailability.status !== "available";

  return (
    <section
      className="rounded-[12px] border border-border bg-background"
      data-owner="user"
      data-provider={row.provider}
    >
      <div className="flex items-center gap-3 p-3">
        <ConnectorIcon provider={row.provider} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="font-medium text-base text-foreground">
              {row.displayName}
            </h3>
            <Badge className="shrink-0" variant="secondary">
              Only you
            </Badge>
          </div>
          <p className="mt-0.5 text-muted-foreground text-sm">
            {row.description}
          </p>
          <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
            {USER_CONNECTOR_AVAILABILITY_COPY}
          </p>
        </div>
        <Button
          disabled={connectDisabled}
          onClick={() => onConnect(row)}
          size="lf"
          type="button"
          variant="outline"
        >
          Connect
          <ArrowUpRight className="size-3.5" />
        </Button>
      </div>
    </section>
  );
}
