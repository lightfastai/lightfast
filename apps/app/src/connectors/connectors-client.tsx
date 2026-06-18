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
} from "@repo/ui-v2/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui-v2/components/ui/select";
import { SidebarTrigger } from "@repo/ui-v2/components/ui/sidebar";
import { Input } from "@repo/ui/components/ui/input";
import { Switch } from "@repo/ui/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { cn } from "@repo/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRightIcon as ArrowUpRight,
  Loading03Icon as Loader2,
  MoreHorizontalIcon as MoreHorizontal,
  SidebarRightIcon as PanelRight,
  ReloadIcon as RefreshCcw,
  Search01Icon as Search,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { WorkspaceSurface } from "~/components/workspace-surface";
import { ConnectorOwnerScopeTabs } from "./connector-owner-scope-tabs";
import { ConnectorDetailSheet } from "./connector-detail-sheet";
import { ConnectorIcon } from "./connector-icons";
import {
  type ConnectorCatalogRow,
  type ConnectorStatusFilter,
  connectionStatus,
  displayProviderName,
  filterConnectorCatalogRows,
  isConnectableProvider,
  isConnectDisabled,
  isMutationDisabled,
  missingConfigFallback,
  missingConfigMessage,
  type TeamConnectorCatalogRow,
  type UserConnectorCatalogRow,
  userConnectionStatus,
} from "./connectors-model";
import {
  connectorQueryKeys,
  connectorSectionsQueryOptions,
  disconnectConnectorMutationOptions,
  refreshConnectorToolsMutationOptions,
  setConnectorAgentEnabledMutationOptions,
  setConnectorAutomationEnabledMutationOptions,
  startConnectorMutationOptions,
} from "./connectors-queries";
import type {
  ConnectorOwnerScope,
  NormalizedConnectorsSearch,
} from "./connectors-search-params";
import {
  disconnectUserConnectorMutationOptions,
  startUserConnectorMutationOptions,
} from "./user-connector-queries";

const ADMIN_REQUIRED_MESSAGE = "Admin access required to manage connectors";
const DISCONNECT_UNAVAILABLE_MESSAGE =
  "Disconnecting isn't available right now.";
const USER_CONNECTOR_AVAILABILITY_COPY =
  "Available in your chats. Not visible to teammates.";

export function ConnectorsClient({
  search,
  setSearchParams,
}: {
  search: NormalizedConnectorsSearch;
  setSearchParams: (updates: Partial<NormalizedConnectorsSearch>) => void;
}) {
  const queryClient = useQueryClient();
  const connectorsQuery = useQuery({
    ...connectorSectionsQueryOptions({ staleTime: 30_000 }),
    enabled: typeof window !== "undefined",
  });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<ConnectorStatusFilter>("all");
  const [callbackState] = useState(() => ({
    connector: search.connector ?? undefined,
    error: search.error ?? undefined,
  }));

  const invalidateList = () =>
    queryClient.invalidateQueries({ queryKey: connectorQueryKeys.all });

  const startConnectMutation = useMutation(
    startConnectorMutationOptions({
      onSuccess: (result) => {
        window.location.assign(result.authorizationUrl);
      },
    })
  );
  const userStartConnectMutation = useMutation(
    startUserConnectorMutationOptions({
      onSuccess: (result) => {
        window.location.assign(result.authorizationUrl);
      },
    })
  );
  const refreshToolsMutation = useMutation(
    refreshConnectorToolsMutationOptions({
      onSuccess: invalidateList,
    })
  );
  const setAutomationEnabledMutation = useMutation(
    setConnectorAutomationEnabledMutationOptions({
      onSuccess: invalidateList,
    })
  );
  const setAgentEnabledMutation = useMutation(
    setConnectorAgentEnabledMutationOptions({
      onSuccess: invalidateList,
    })
  );
  const disconnectMutation = useMutation(
    disconnectConnectorMutationOptions({
      onSuccess: invalidateList,
    })
  );
  const userDisconnectMutation = useMutation(
    disconnectUserConnectorMutationOptions({
      onSuccess: invalidateList,
    })
  );

  useEffect(() => {
    if (!callbackState.error) {
      return;
    }
    setSearchParams({ connector: null, error: null });
  }, [callbackState.error, setSearchParams]);

  const shouldUsePersonalScope =
    callbackState.connector === "granola" || search.connector === "granola";

  useEffect(() => {
    if (shouldUsePersonalScope && search.scope !== "personal") {
      setSearchParams({ scope: "personal" });
    }
  }, [search.scope, setSearchParams, shouldUsePersonalScope]);

  const ownerView: ConnectorOwnerScope = shouldUsePersonalScope
    ? "personal"
    : search.scope;
  const teamConnectors = connectorsQuery.data?.teamConnectors ?? [];
  const yourConnectors = connectorsQuery.data?.yourConnectors ?? [];
  const filteredTeamConnectors = useMemo(
    () => filterConnectorCatalogRows(teamConnectors, { query, statusFilter }),
    [teamConnectors, query, statusFilter]
  );
  const filteredYourConnectors = useMemo(
    () => filterConnectorCatalogRows(yourConnectors, { query, statusFilter }),
    [yourConnectors, query, statusFilter]
  );
  const activeFilteredConnectors =
    ownerView === "team" ? filteredTeamConnectors : filteredYourConnectors;
  const activeConnectors =
    ownerView === "team" ? teamConnectors : yourConnectors;
  const activeSection =
    ownerView === "team"
      ? {
          description: "Shared workspace connectors managed by admins.",
          emptyLabel: "No team connectors are available yet.",
          owner: "team" as const,
          panelId: "team-connectors-panel",
          title: "Team connectors",
        }
      : {
          description:
            "Private connectors connected to your account and available in your chats.",
          emptyLabel: "No personal connectors are available yet.",
          owner: "user" as const,
          panelId: "personal-connectors-panel",
          title: "Personal connectors",
        };
  const setOwnerScope = (scope: ConnectorOwnerScope) => {
    setSearchParams({ scope });
  };

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

  function setAutomationEnabled(
    row: TeamConnectorCatalogRow,
    enabled: boolean
  ) {
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
    setSearchParams({ connector: row.provider });
  }

  const sheetProvider = callbackState.error ? null : search.connector;
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
    <WorkspaceSurface className="max-w-3xl px-6 py-10">
      <header>
        <div className="flex items-center gap-2">
          <SidebarTrigger className="size-8 rounded-lg border border-border/70 bg-muted/30 p-0 text-muted-foreground hover:bg-muted/60 hover:text-foreground md:hidden" />
          <h1 className="font-semibold text-2xl text-foreground tracking-[-0.02em]">
            Connectors
          </h1>
        </div>
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

      <div
        className="mt-8 flex flex-col gap-3"
        data-testid="connectors-actions-row"
      >
        <ConnectorOwnerScopeTabs
          onOwnerScopeChange={setOwnerScope}
          ownerScope={ownerView}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 flex-1">
            <HugeiconsIcon icon={Search} className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
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
          <Select
            onValueChange={(value) => {
              if (value !== null) {
                setStatusFilter(value as ConnectorStatusFilter);
              }
            }}
            value={statusFilter}
          >
            <SelectTrigger aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="connected">Connected</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="needs_reconnect">Needs reconnect</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {connectorsQuery.isPending ? (
        <ConnectorsLoading />
      ) : connectorsQuery.isError ? (
        <ConnectorsError onRetry={() => void connectorsQuery.refetch()} />
      ) : (
        <div className="mt-6">
          <ConnectorSection
            description={activeSection.description}
            owner={activeSection.owner}
            panelId={activeSection.panelId}
            title={activeSection.title}
          >
            {activeFilteredConnectors.length > 0 ? (
              ownerView === "team" ? (
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
                        refreshToolsMutation.variables?.provider ===
                          row.provider
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
              )
            ) : (
              <SectionEmptyState
                emptyLabel={activeSection.emptyLabel}
                hasCatalogConnectors={activeConnectors.length > 0}
              />
            )}
          </ConnectorSection>
        </div>
      )}

      <ConnectorDetailSheet
        onOpenChange={(open) => {
          if (!open) {
            setSearchParams({ connector: null });
          }
        }}
        row={sheetRow}
      />
    </WorkspaceSurface>
  );
}

function ConnectorsLoading() {
  return (
    <div className="mt-6 flex flex-col gap-4" role="status">
      <span className="sr-only">Loading connectors</span>
      {[0, 1].map((index) => (
        <div
          className="rounded-[12px] border border-border bg-background p-3"
          key={index}
        >
          <div className="flex items-center gap-3">
            <div className="size-9 animate-pulse rounded-[9px] bg-muted" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-7 w-20 animate-pulse rounded-[9px] bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ConnectorsError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mt-6 rounded-[12px] border border-border bg-background p-4">
      <p className="font-medium text-foreground text-sm">
        Unable to load connectors
      </p>
      <p className="mt-1 text-muted-foreground text-sm">
        Check your connection and try again.
      </p>
      <Button className="mt-3" onClick={onRetry} size="lf" type="button">
        Retry
      </Button>
    </div>
  );
}

function ConnectorSection({
  children,
  description,
  owner,
  panelId,
  title,
}: {
  children: ReactNode;
  description: string;
  owner: "team" | "user";
  panelId: string;
  title: string;
}) {
  const labelledBy =
    owner === "team" ? "team-connectors-tab" : "personal-connectors-tab";

  return (
    <section
      aria-labelledby={labelledBy}
      data-owner={owner}
      id={panelId}
      role="tabpanel"
    >
      <h2 className="font-medium text-foreground text-sm">{title}</h2>
      <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
        {description}
      </p>
      <div className="mt-3 flex flex-col gap-4">{children}</div>
    </section>
  );
}

function SectionEmptyState({
  emptyLabel,
  hasCatalogConnectors,
}: {
  emptyLabel: string;
  hasCatalogConnectors: boolean;
}) {
  return (
    <p className="text-muted-foreground text-sm">
      {hasCatalogConnectors ? "No connectors match these filters." : emptyLabel}
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
  const actionDisabled = isMutationDisabled(row, pending);
  const connectDisabled = isConnectDisabled(row, pending);
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
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label="Connector actions"
                  className="h-6 w-6 rounded-full"
                  size="sm"
                  type="button"
                  variant="ghost"
                />
              }
            >
              <HugeiconsIcon icon={MoreHorizontal} className="size-3.5 opacity-50" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onViewDetails(row)}>
                <HugeiconsIcon icon={PanelRight} className="size-3.5" />
                View details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={actionDisabled || refreshing}
                onClick={() => onRefreshTools(row)}
              >
                {refreshing ? (
                  <HugeiconsIcon icon={Loader2} className="size-3.5 animate-spin" />
                ) : (
                  <HugeiconsIcon icon={RefreshCcw} className="size-3.5" />
                )}
                Refresh tools
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={connectDisabled}
                onClick={() => onConnect(row)}
              >
                <HugeiconsIcon icon={ArrowUpRight} className="size-3.5" />
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
                    closeOnClick={!actionDisabled}
                    onClick={(event) => {
                      if (actionDisabled) {
                        event.preventDefault();
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
            <HugeiconsIcon icon={Loader2} className="size-3.5 animate-spin text-muted-foreground" />
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
            Allow automations to read and write through {row.displayName} tools.
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
            Allow agent surfaces to discover and call read/write tools from{" "}
            {row.displayName}.
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
  const connectDisabled = isConnectDisabled(row, pending);
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
            <HugeiconsIcon icon={ArrowUpRight} className="size-3.5" />
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
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label="Connector actions"
                  className="h-6 w-6 rounded-full"
                  size="sm"
                  type="button"
                  variant="ghost"
                />
              }
            >
              <HugeiconsIcon icon={MoreHorizontal} className="size-3.5 opacity-50" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onViewDetails(row)}>
                <HugeiconsIcon icon={PanelRight} className="size-3.5" />
                View details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={actionDisabled}
                onClick={() => onConnect(row)}
              >
                <HugeiconsIcon icon={ArrowUpRight} className="size-3.5" />
                Reconnect
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={actionDisabled}
                onClick={() => setConfirmOpen(true)}
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
          <p className="mt-3 rounded-[8px] border border-border border-dashed px-3 py-2 text-muted-foreground text-sm">
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
          <HugeiconsIcon icon={ArrowUpRight} className="size-3.5" />
        </Button>
      </div>
    </section>
  );
}
