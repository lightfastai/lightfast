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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Switch } from "@repo/ui/components/ui/switch";
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
  RefreshCcw,
  Search,
} from "lucide-react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTRPC } from "~/trpc/react";
import { ConnectorIcon } from "./connector-icons";
import {
  type ConnectorCatalogRow,
  type ConnectorProvider,
  connectionStatus,
  displayProviderName,
} from "./connectors-model";

type StatusFilter = "all" | "connected" | "available" | "needs_reconnect";

interface ConnectorsClientProps {
  callbackConnector?: string;
  callbackError?: string;
}

const CONNECTABLE_PROVIDER: ConnectorProvider = "linear";
const ADMIN_REQUIRED_MESSAGE = "Admin access required to manage connectors";

function isConnectableProvider(
  provider: ConnectorProvider
): provider is "linear" {
  return provider === CONNECTABLE_PROVIDER;
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

function isMutationDisabled(row: ConnectorCatalogRow, pending: boolean) {
  return pending || !row.canManage || !isConnectableProvider(row.provider);
}

function isConnectDisabled(row: ConnectorCatalogRow, pending: boolean) {
  return (
    isMutationDisabled(row, pending) ||
    row.connectAvailability.status !== "available"
  );
}

export function ConnectorsClient({
  callbackConnector,
  callbackError,
}: ConnectorsClientProps = {}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const listQueryOptions = trpc.org.workspace.connectors.list.queryOptions();
  const { data: connectors } = useSuspenseQuery({
    ...listQueryOptions,
    staleTime: 30_000,
  });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [callbackState] = useState(() => ({
    connector: callbackConnector,
    error: callbackError,
  }));

  const invalidateList = () =>
    queryClient.invalidateQueries(
      trpc.org.workspace.connectors.list.queryFilter()
    );

  const startConnectMutation = useMutation(
    trpc.org.workspace.connectors.startConnect.mutationOptions({
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
  const disconnectMutation = useMutation(
    trpc.org.workspace.connectors.disconnect.mutationOptions({
      onSuccess: invalidateList,
    })
  );

  useEffect(() => {
    if (callbackConnector || callbackError) {
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.delete("connector");
      nextParams.delete("error");
      const queryString = nextParams.toString();
      router.replace(
        (queryString ? `${pathname}?${queryString}` : pathname) as Route
      );
    }
  }, [callbackConnector, callbackError, pathname, router, searchParams]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredConnectors = useMemo(
    () =>
      connectors.filter((row) => {
        const matchesQuery =
          normalizedQuery.length === 0 ||
          [row.displayName, row.description, row.category, row.provider].some(
            (value) => value.toLowerCase().includes(normalizedQuery)
          );
        return matchesQuery && filterMatches(row, statusFilter);
      }),
    [connectors, normalizedQuery, statusFilter]
  );

  function connect(row: ConnectorCatalogRow) {
    if (isConnectableProvider(row.provider)) {
      startConnectMutation.mutate({ provider: row.provider });
    }
  }

  function refreshTools(row: ConnectorCatalogRow) {
    if (isConnectableProvider(row.provider)) {
      refreshToolsMutation.mutate({ provider: row.provider });
    }
  }

  function setAutomationEnabled(row: ConnectorCatalogRow, enabled: boolean) {
    if (isConnectableProvider(row.provider)) {
      setAutomationEnabledMutation.mutate({ enabled, provider: row.provider });
    }
  }

  function disconnect(row: ConnectorCatalogRow) {
    if (isConnectableProvider(row.provider)) {
      disconnectMutation.mutate({ provider: row.provider });
    }
  }

  const mutationPending =
    startConnectMutation.isPending ||
    refreshToolsMutation.isPending ||
    setAutomationEnabledMutation.isPending ||
    disconnectMutation.isPending;

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
      {callbackState.connector && !callbackState.error && (
        <div className="mt-6 rounded-[9px] border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-emerald-600 text-sm">
          {displayProviderName(callbackState.connector)} connected.
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
        <Select
          onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          value={statusFilter}
        >
          <SelectTrigger
            aria-label="Status"
            className="h-7 shrink-0 rounded-[9px] sm:w-44"
            size="sm"
          >
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="connected">Connected</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="needs_reconnect">Needs reconnect</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredConnectors.length === 0 ? (
        <p className="mt-6 text-muted-foreground text-sm">
          No connectors match these filters.
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {filteredConnectors.map((row) =>
            row.connection ? (
              <ConnectedConnectorCard
                key={row.provider}
                onConnect={connect}
                onDisconnect={disconnect}
                onRefreshTools={refreshTools}
                onSetAutomationEnabled={setAutomationEnabled}
                pending={mutationPending}
                refreshing={
                  refreshToolsMutation.isPending &&
                  refreshToolsMutation.variables?.provider === row.provider
                }
                row={row}
              />
            ) : (
              <AvailableConnectorCard
                key={row.provider}
                onConnect={connect}
                pending={mutationPending}
                row={row}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

function ConnectedConnectorCard({
  onConnect,
  onDisconnect,
  onRefreshTools,
  onSetAutomationEnabled,
  pending,
  refreshing,
  row,
}: {
  onConnect: (row: ConnectorCatalogRow) => void;
  onDisconnect: (row: ConnectorCatalogRow) => void;
  onRefreshTools: (row: ConnectorCatalogRow) => void;
  onSetAutomationEnabled: (row: ConnectorCatalogRow, enabled: boolean) => void;
  pending: boolean;
  refreshing: boolean;
  row: ConnectorCatalogRow;
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
    <section className="rounded-[12px] border border-border bg-background">
      <div className="flex items-center gap-3 p-3">
        <ConnectorIcon provider={row.provider} />
        <div className="min-w-0 flex-1">
          <h2 className="font-medium text-base text-foreground">
            {row.displayName}
          </h2>
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
              <DropdownMenuItem
                disabled={actionDisabled}
                onSelect={(event) => {
                  event.preventDefault();
                  setConfirmOpen(true);
                }}
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

function AvailableConnectorCard({
  onConnect,
  pending,
  row,
}: {
  onConnect: (row: ConnectorCatalogRow) => void;
  pending: boolean;
  row: ConnectorCatalogRow;
}) {
  const connectDisabled = isConnectDisabled(row, pending);
  const showAdminRequired =
    !row.canManage && isConnectableProvider(row.provider);
  const missingConfig =
    row.connectAvailability.status === "unavailable" &&
    row.connectAvailability.reason === "missing_config";

  return (
    <section className="rounded-[12px] border border-border bg-background">
      <div className="flex items-center gap-3 p-3">
        <ConnectorIcon provider={row.provider} />
        <div className="min-w-0 flex-1">
          <h2 className="font-medium text-base text-foreground">
            {row.displayName}
          </h2>
          <p className="mt-0.5 text-muted-foreground text-sm">
            {row.description}
          </p>
          {missingConfig && (
            <p className="mt-1 text-muted-foreground text-xs">
              Missing config:{" "}
              <span className="text-foreground">
                {row.connectAvailability.status === "unavailable"
                  ? (row.connectAvailability.missing?.join(", ") ??
                    "Linear OAuth")
                  : "Linear OAuth"}
              </span>
            </p>
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
