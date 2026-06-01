"use client";

import type { AppRouterOutputs } from "@api/app";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/ui/components/ui/alert-dialog";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
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
  ChevronDown,
  ChevronRight,
  ExternalLink,
  RefreshCcw,
  Search,
} from "lucide-react";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTRPC } from "~/trpc/react";
import { ConnectorIcon } from "./connector-icons";

type ConnectorCatalogRow =
  AppRouterOutputs["org"]["workspace"]["connectors"]["list"][number];
type ConnectorProvider = ConnectorCatalogRow["provider"];
type StatusFilter =
  | "all"
  | "connected"
  | "available"
  | "needs_reconnect"
  | "coming_soon";

interface ConnectorsClientProps {
  callbackConnector?: string;
  callbackError?: string;
}

const CONNECTABLE_PROVIDER: ConnectorProvider = "linear";
const MAX_VISIBLE_TOOLS = 6;

function isConnectableProvider(
  provider: ConnectorProvider
): provider is "linear" {
  return provider === CONNECTABLE_PROVIDER;
}

function displayProviderName(provider: string | undefined) {
  if (!provider) {
    return "Connector";
  }
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function connectionLabel(row: ConnectorCatalogRow) {
  if (row.connection?.status === "error") {
    return "Needs reconnect";
  }
  if (
    row.connection?.status === "active" &&
    row.connection.lastToolRefreshErrorAt
  ) {
    return "Tools stale";
  }
  if (row.connection?.status === "active") {
    return "Connected";
  }
  if (row.catalogStatus === "coming_soon") {
    return "Coming soon";
  }
  if (row.connectAvailability.status === "unavailable") {
    if (row.connectAvailability.reason === "missing_config") {
      return "Missing config";
    }
    if (row.connectAvailability.reason === "permission_required") {
      return "Admin required";
    }
  }
  return "Available";
}

function filterMatches(row: ConnectorCatalogRow, filter: StatusFilter) {
  switch (filter) {
    case "available":
      return !row.connection && row.catalogStatus === "available";
    case "coming_soon":
      return row.catalogStatus === "coming_soon";
    case "connected":
      return !!row.connection;
    case "needs_reconnect":
      return row.connection?.status === "error";
    case "all":
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
  const listQueryOptions = trpc.org.workspace.connectors.list.queryOptions();
  const { data: connectors } = useSuspenseQuery({
    ...listQueryOptions,
    staleTime: 30_000,
  });
  const [query, setQuery] = useState("");
  const [builtByLightfastOnly, setBuiltByLightfastOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expandedProviders, setExpandedProviders] = useState<
    Set<ConnectorProvider>
  >(
    () =>
      new Set(
        connectors
          .filter((row) => row.provider === "linear" && !!row.connection)
          .map((row) => row.provider)
      )
  );
  const [expandedTools, setExpandedTools] = useState<Set<ConnectorProvider>>(
    () => new Set()
  );
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
      router.replace(pathname as Route);
    }
  }, [callbackConnector, callbackError, pathname, router]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredConnectors = useMemo(
    () =>
      connectors.filter((row) => {
        const matchesQuery =
          normalizedQuery.length === 0 ||
          [row.displayName, row.description, row.category, row.provider].some(
            (value) => value.toLowerCase().includes(normalizedQuery)
          );
        const matchesBuilder =
          !builtByLightfastOnly || row.builder === "Lightfast";
        return (
          matchesQuery && matchesBuilder && filterMatches(row, statusFilter)
        );
      }),
    [builtByLightfastOnly, connectors, normalizedQuery, statusFilter]
  );
  const linear = connectors.find((row) => row.provider === "linear");
  const catalogRows = filteredConnectors.filter(
    (row) => row.provider !== "linear"
  );

  function toggleExpanded(provider: ConnectorProvider) {
    setExpandedProviders((current) => {
      const next = new Set(current);
      if (next.has(provider)) {
        next.delete(provider);
      } else {
        next.add(provider);
      }
      return next;
    });
  }

  function toggleTools(provider: ConnectorProvider) {
    setExpandedTools((current) => {
      const next = new Set(current);
      if (next.has(provider)) {
        next.delete(provider);
      } else {
        next.add(provider);
      }
      return next;
    });
  }

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
      setAutomationEnabledMutation.mutate({
        enabled,
        provider: row.provider,
      });
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
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="mx-auto max-w-2xl text-center">
        <h1 className="font-semibold text-[22px] text-foreground">
          Connectors
        </h1>
        <p className="mt-2 text-[13px] text-muted-foreground">
          Allow Lightfast to reference other apps through MCP connectors.
        </p>
      </header>

      {callbackState.error && (
        <div className="mt-6 rounded-[8px] border border-destructive/25 bg-destructive/5 px-3 py-2 text-[12px]">
          <p className="font-medium text-destructive">
            {displayProviderName(callbackState.connector)} connection failed
          </p>
          <p className="mt-1 font-mono text-destructive/85">
            {callbackState.error}
          </p>
        </div>
      )}
      {callbackState.connector && !callbackState.error && (
        <div className="mt-6 rounded-[8px] border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[12px] text-emerald-700">
          {displayProviderName(callbackState.connector)} connected.
        </div>
      )}

      <div className="mt-8 flex flex-col gap-3 border-border border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1">
          <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-2.5 size-3.5 text-muted-foreground" />
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
        <div className="flex shrink-0 items-center gap-2">
          <Button
            aria-pressed={builtByLightfastOnly}
            className={cn(
              "h-7 rounded-[9px] text-[12px]",
              builtByLightfastOnly && "bg-muted"
            )}
            onClick={() => setBuiltByLightfastOnly((value) => !value)}
            size="sm"
            type="button"
            variant="outline"
          >
            Built by Lightfast
          </Button>
          <Select
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
            value={statusFilter}
          >
            <SelectTrigger
              aria-label="Status"
              className="h-7 rounded-[9px]"
              size="sm"
            >
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="connected">Connected</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="needs_reconnect">Needs reconnect</SelectItem>
              <SelectItem value="coming_soon">Coming soon</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {linear && (
        <section className="mt-6 rounded-[8px] border border-border bg-card p-4">
          <ConnectorRow
            expanded={expandedProviders.has(linear.provider)}
            expandedTools={expandedTools.has(linear.provider)}
            featured
            mutationPending={mutationPending}
            onConnect={connect}
            onDisconnect={disconnect}
            onRefreshTools={refreshTools}
            onSetAutomationEnabled={setAutomationEnabled}
            onToggleExpanded={toggleExpanded}
            onToggleTools={toggleTools}
            row={linear}
          />
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-mono font-normal text-[11px] text-muted-foreground">
          Catalog
        </h2>
        <div className="mt-3 divide-y divide-border border-border border-y">
          {catalogRows.map((row) => (
            <ConnectorRow
              expanded={expandedProviders.has(row.provider)}
              expandedTools={expandedTools.has(row.provider)}
              key={row.provider}
              mutationPending={mutationPending}
              onConnect={connect}
              onDisconnect={disconnect}
              onRefreshTools={refreshTools}
              onSetAutomationEnabled={setAutomationEnabled}
              onToggleExpanded={toggleExpanded}
              onToggleTools={toggleTools}
              row={row}
            />
          ))}
          {catalogRows.length === 0 && (
            <p className="py-6 text-[12px] text-muted-foreground">
              No connectors match these filters.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function ConnectorRow({
  expanded,
  expandedTools,
  featured = false,
  mutationPending,
  onConnect,
  onDisconnect,
  onRefreshTools,
  onSetAutomationEnabled,
  onToggleExpanded,
  onToggleTools,
  row,
}: {
  expanded: boolean;
  expandedTools: boolean;
  featured?: boolean;
  mutationPending: boolean;
  onConnect: (row: ConnectorCatalogRow) => void;
  onDisconnect: (row: ConnectorCatalogRow) => void;
  onRefreshTools: (row: ConnectorCatalogRow) => void;
  onSetAutomationEnabled: (row: ConnectorCatalogRow, enabled: boolean) => void;
  onToggleExpanded: (provider: ConnectorProvider) => void;
  onToggleTools: (provider: ConnectorProvider) => void;
  row: ConnectorCatalogRow;
}) {
  const label = connectionLabel(row);
  const hasDetails = !!row.connection;

  return (
    <div className={cn("py-4", featured ? "py-0" : "")}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <ConnectorIcon provider={row.provider} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                className={cn(
                  "font-medium text-foreground",
                  featured ? "text-[16px]" : "text-[14px]"
                )}
              >
                {row.displayName}
              </h2>
              <Badge
                className="rounded-[7px] px-1.5 py-0 font-mono text-[10px]"
                variant={
                  label === "Needs reconnect" ? "destructive" : "outline"
                }
              >
                {label}
              </Badge>
              <Badge
                className="rounded-[7px] px-1.5 py-0 font-mono text-[10px]"
                variant="secondary"
              >
                {row.builder}
              </Badge>
            </div>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {row.description}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-muted-foreground">
              <span>{row.category}</span>
              {row.connection?.providerWorkspaceName && (
                <span>{row.connection.providerWorkspaceName}</span>
              )}
              {row.connection?.providerActorName && (
                <span>{row.connection.providerActorName}</span>
              )}
            </div>
            {row.connectAvailability.status === "unavailable" &&
              row.connectAvailability.reason === "missing_config" && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Missing config:{" "}
                  <span className="font-mono">
                    {row.connectAvailability.missing?.join(", ") ??
                      "Linear OAuth"}
                  </span>
                </p>
              )}
          </div>
        </div>

        <ConnectorActions
          onConnect={onConnect}
          onDisconnect={onDisconnect}
          onRefreshTools={onRefreshTools}
          pending={mutationPending}
          row={row}
        />
      </div>

      {hasDetails && (
        <div className="mt-4">
          <button
            className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => onToggleExpanded(row.provider)}
            type="button"
          >
            {expanded ? (
              <ChevronDown className="size-3" />
            ) : (
              <ChevronRight className="size-3" />
            )}
            Tools
          </button>
          {expanded && (
            <ConnectorDetails
              expandedTools={expandedTools}
              onSetAutomationEnabled={onSetAutomationEnabled}
              onToggleTools={onToggleTools}
              pending={mutationPending}
              row={row}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ConnectorActions({
  onConnect,
  onDisconnect,
  onRefreshTools,
  pending,
  row,
}: {
  onConnect: (row: ConnectorCatalogRow) => void;
  onDisconnect: (row: ConnectorCatalogRow) => void;
  onRefreshTools: (row: ConnectorCatalogRow) => void;
  pending: boolean;
  row: ConnectorCatalogRow;
}) {
  const connectDisabled = isConnectDisabled(row, pending);
  const actionDisabled = isMutationDisabled(row, pending);

  if (!row.connection) {
    return (
      <Button
        className="h-7 rounded-[9px]"
        disabled={connectDisabled}
        onClick={() => onConnect(row)}
        size="sm"
        type="button"
        variant="secondary"
      >
        Connect
        <ExternalLink className="size-3.5" />
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
      <Button
        className="h-7 rounded-[9px]"
        disabled={actionDisabled}
        onClick={() => onRefreshTools(row)}
        size="sm"
        type="button"
        variant="outline"
      >
        <RefreshCcw className="size-3.5" />
        Refresh tools
      </Button>
      <Button
        className="h-7 rounded-[9px]"
        disabled={connectDisabled}
        onClick={() => onConnect(row)}
        size="sm"
        type="button"
        variant="outline"
      >
        Reconnect
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            className="h-7 rounded-[9px]"
            disabled={actionDisabled}
            size="sm"
            type="button"
            variant="outline"
          >
            Disconnect
          </Button>
        </AlertDialogTrigger>
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
    </div>
  );
}

function ConnectorDetails({
  expandedTools,
  onSetAutomationEnabled,
  onToggleTools,
  pending,
  row,
}: {
  expandedTools: boolean;
  onSetAutomationEnabled: (row: ConnectorCatalogRow, enabled: boolean) => void;
  onToggleTools: (provider: ConnectorProvider) => void;
  pending: boolean;
  row: ConnectorCatalogRow;
}) {
  if (!row.connection) {
    return null;
  }

  const tools = expandedTools
    ? row.connection.tools
    : row.connection.tools.slice(0, MAX_VISIBLE_TOOLS);
  const actionDisabled = isMutationDisabled(row, pending);

  return (
    <div className="mt-3 rounded-[8px] border border-border bg-background/50 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-[11px] text-foreground">
            {row.connection.tools.length} tools available
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            All connector tools are allowed for automations initially.
          </p>
        </div>
        <label className="flex items-center gap-2 text-[12px] text-foreground">
          <Switch
            aria-label="Use in automations"
            checked={row.connection.enabledForAutomations}
            disabled={actionDisabled}
            onCheckedChange={(enabled) => onSetAutomationEnabled(row, enabled)}
          />
          Use in automations
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {tools.map((tool) => (
          <span
            className={cn(
              "inline-flex items-center rounded-[7px] border px-2 py-1 font-mono text-[10px]",
              tool.availableForAutomations
                ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-700"
                : "border-border text-muted-foreground"
            )}
            key={tool.name}
            title={tool.description}
          >
            {tool.name}
          </span>
        ))}
      </div>
      {row.connection.tools.length > MAX_VISIBLE_TOOLS && (
        <Button
          className="mt-3 h-6 rounded-[8px] px-2 text-[11px]"
          onClick={() => onToggleTools(row.provider)}
          size="sm"
          type="button"
          variant="ghost"
        >
          {expandedTools ? "See less" : "See more"}
        </Button>
      )}
    </div>
  );
}
