import {
  type CompleteSentryDeveloperConnectionAuthInput,
  type ConnectDeveloperConnectionInput,
  completeSentryDeveloperConnectionAuth,
  connectDeveloperConnection,
  type DisconnectDeveloperConnectionInput,
  disconnectDeveloperConnection,
  type SetDeveloperConnectionSandboxEnabledInput,
  type StartSentryDeveloperConnectionAuthInput,
  type StartSentryDeveloperConnectionAuthResult,
  setDeveloperConnectionSandboxEnabled,
  startSentryDeveloperConnectionAuth,
} from "@api/app/tanstack/developer-connections";
import {
  ArrowUpRightIcon as ArrowUpRight,
  SidebarRightIcon as PanelRight,
  Search01Icon as Search,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Switch } from "@repo/ui/components/ui/switch";
import { cn } from "@repo/ui/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui-v2/components/ui/select";
import { SidebarTrigger } from "@repo/ui-v2/components/ui/sidebar";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { DeveloperConnectionDetailSheet } from "./developer-connection-detail-sheet";
import { DeveloperConnectionIcon } from "./developer-connection-icons";
import {
  type DeveloperConnectionCatalogRow,
  developerConnectionStatus,
  displayDeveloperConnectionProvider,
} from "./developer-connections-model";
import {
  developerConnectionQueryKeys,
  developerConnectionsQueryOptions,
} from "./developer-connections-queries";
import type { NormalizedDeveloperConnectionsSearch } from "./developer-connections-search-params";

type StatusFilter =
  | "all"
  | "available"
  | "connected"
  | "disabled"
  | "needs_reconnect";

type DeveloperConnectionConnectInput =
  | {
      provider: "pscale";
      providerAccountName: string;
      serviceTokenId: string;
      serviceToken: string;
    }
  | {
      provider: "upstash";
      providerAccountName: string;
      email: string;
      apiKey: string;
    }
  | {
      provider: "sentry";
      providerAccountName: string;
      token: string;
    }
  | {
      provider: "clerk";
      providerAccountName: string;
      appId: string;
      instanceId: string;
      secretKey: string;
    };

const ADMIN_REQUIRED_MESSAGE =
  "Admin access required to manage developer connections.";

function filterMatches(
  row: DeveloperConnectionCatalogRow,
  filter: StatusFilter
) {
  const status = developerConnectionStatus(row)
    .label.toLowerCase()
    .replace(" ", "_");
  return filter === "all" || status === filter;
}

export function DeveloperConnectionsClient({
  search,
  setSearchParams,
}: {
  search: NormalizedDeveloperConnectionsSearch;
  setSearchParams: (
    updates: Partial<NormalizedDeveloperConnectionsSearch>
  ) => void;
}) {
  const queryClient = useQueryClient();
  const listQuery = useQuery(
    developerConnectionsQueryOptions({ staleTime: 30_000 })
  );
  const connections = listQuery.data ?? [];
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [connectRow, setConnectRow] =
    useState<DeveloperConnectionCatalogRow | null>(null);
  const [callbackError, setCallbackError] = useState<{
    error: string;
    provider: string | null;
  } | null>(null);
  const [sentryAuthAttempt, setSentryAuthAttempt] = useState<{
    attemptId: string;
    userCode: string;
    verificationUri: string;
  } | null>(null);

  const invalidateList = () => {
    void queryClient.invalidateQueries({
      queryKey: developerConnectionQueryKeys.list(),
    });
  };

  const connectMutation = useMutation({
    meta: { errorTitle: "Failed to connect developer provider" },
    mutationFn: (data: ConnectDeveloperConnectionInput) =>
      connectDeveloperConnection({ data }),
    onSuccess: () => {
      setConnectRow(null);
      invalidateList();
    },
  });
  const startSentryAuthMutation = useMutation({
    meta: { errorTitle: "Failed to start Sentry authorization" },
    mutationFn: (data: StartSentryDeveloperConnectionAuthInput) =>
      startSentryDeveloperConnectionAuth({ data }),
    onSuccess: (result: StartSentryDeveloperConnectionAuthResult) => {
      setSentryAuthAttempt({
        attemptId: result.attemptId,
        userCode: result.userCode,
        verificationUri: result.verificationUri,
      });
    },
  });
  const completeSentryAuthMutation = useMutation({
    meta: { errorTitle: "Failed to complete Sentry authorization" },
    mutationFn: (data: CompleteSentryDeveloperConnectionAuthInput) =>
      completeSentryDeveloperConnectionAuth({ data }),
    onSuccess: () => {
      setConnectRow(null);
      setSentryAuthAttempt(null);
      invalidateList();
    },
  });
  const setSandboxEnabledMutation = useMutation({
    meta: { errorTitle: "Failed to update sandbox access" },
    mutationFn: (data: SetDeveloperConnectionSandboxEnabledInput) =>
      setDeveloperConnectionSandboxEnabled({ data }),
    onSuccess: invalidateList,
  });
  const disconnectMutation = useMutation({
    meta: { errorTitle: "Failed to disconnect developer provider" },
    mutationFn: (data: DisconnectDeveloperConnectionInput) =>
      disconnectDeveloperConnection({ data }),
    onSuccess: invalidateList,
  });

  useEffect(() => {
    if (!search.error) {
      return;
    }
    setCallbackError({ error: search.error, provider: search.connection });
    setSearchParams({ connection: null, error: null });
  }, [search.connection, search.error, setSearchParams]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredConnections = useMemo(
    () =>
      connections.filter((row) => {
        const matchesQuery =
          normalizedQuery.length === 0 ||
          [row.displayName, row.description, row.category, row.provider].some(
            (value) => value.toLowerCase().includes(normalizedQuery)
          );
        return matchesQuery && filterMatches(row, statusFilter);
      }),
    [connections, normalizedQuery, statusFilter]
  );

  const sheetRow = search.connection
    ? connections.find(
        (row) => row.provider === search.connection && row.connection
      )
    : undefined;

  const pending =
    connectMutation.isPending ||
    startSentryAuthMutation.isPending ||
    completeSentryAuthMutation.isPending ||
    setSandboxEnabledMutation.isPending ||
    disconnectMutation.isPending;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <header>
        <div className="flex items-center gap-2">
          <SidebarTrigger className="size-8 rounded-lg border border-border/70 bg-muted/30 p-0 text-muted-foreground hover:bg-muted/60 hover:text-foreground md:hidden" />
          <h1 className="font-semibold text-2xl text-foreground tracking-[-0.02em]">
            Developer Connections
          </h1>
        </div>
        <p className="mt-2 max-w-xl text-muted-foreground text-sm">
          Connect provider CLIs for Lightfast-controlled sandbox workflows.
        </p>
      </header>

      {callbackError ? (
        <div className="mt-6 rounded-[9px] border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm">
          <p className="font-medium text-destructive">
            {displayDeveloperConnectionProvider(
              callbackError.provider ?? undefined
            )}
            {" connection failed"}
          </p>
          <p className="mt-1 text-destructive/85">{callbackError.error}</p>
        </div>
      ) : null}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1">
          <HugeiconsIcon
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            icon={Search}
          />
          <Input
            aria-label="Search developer connections"
            className="pl-8"
            onChange={(event) => setQuery(event.currentTarget.value)}
            size="lf"
            value={query}
            variant="lf"
          />
        </div>
        <Select
          onValueChange={(value) => {
            if (value !== null) {
              setStatusFilter(value as StatusFilter);
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
            <SelectItem value="disabled">Disabled</SelectItem>
            <SelectItem value="needs_reconnect">Needs reconnect</SelectItem>
            <SelectItem value="available">Available</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {listQuery.isPending ? (
        <p className="mt-6 text-muted-foreground text-sm">
          Loading developer connections...
        </p>
      ) : filteredConnections.length === 0 ? (
        <p className="mt-6 text-muted-foreground text-sm">
          No developer connections match these filters.
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {filteredConnections.map((row) => (
            <DeveloperConnectionCard
              key={row.provider}
              onConnect={(nextRow) => {
                setSentryAuthAttempt(null);
                setConnectRow(nextRow);
              }}
              onDisconnect={(provider) =>
                disconnectMutation.mutate({ provider })
              }
              onSetSandboxEnabled={(provider, enabled) =>
                setSandboxEnabledMutation.mutate({ provider, enabled })
              }
              onViewDetails={(provider) =>
                setSearchParams({ connection: provider })
              }
              pending={pending}
              row={row}
            />
          ))}
        </div>
      )}

      {connectRow ? (
        <DeveloperConnectionConnectDialog
          onClose={() => {
            setConnectRow(null);
            setSentryAuthAttempt(null);
          }}
          onCompleteSentryAuth={(attemptId) =>
            completeSentryAuthMutation.mutate({
              attemptId,
              provider: "sentry",
            })
          }
          onStartSentryAuth={(providerAccountName) =>
            startSentryAuthMutation.mutate({
              provider: "sentry",
              providerAccountName,
            })
          }
          onSubmit={(input) => connectMutation.mutate(input)}
          row={connectRow}
          sentryAuthAttempt={sentryAuthAttempt}
        />
      ) : null}

      <DeveloperConnectionDetailSheet
        onOpenChange={(open) => {
          if (!open) {
            setSearchParams({ connection: null });
          }
        }}
        row={sheetRow}
      />
    </div>
  );
}

function DeveloperConnectionCard({
  onConnect,
  onDisconnect,
  onSetSandboxEnabled,
  onViewDetails,
  pending,
  row,
}: {
  onConnect: (row: DeveloperConnectionCatalogRow) => void;
  onDisconnect: (provider: DeveloperConnectionCatalogRow["provider"]) => void;
  onSetSandboxEnabled: (
    provider: DeveloperConnectionCatalogRow["provider"],
    enabled: boolean
  ) => void;
  onViewDetails: (provider: DeveloperConnectionCatalogRow["provider"]) => void;
  pending: boolean;
  row: DeveloperConnectionCatalogRow;
}) {
  const status = developerConnectionStatus(row);
  const connected = Boolean(row.connection);
  const canManage =
    row.canManage && row.connectAvailability.status === "available";
  const sandboxSwitchId = `developer-connection-${row.provider}-sandbox`;

  return (
    <section className="rounded-[12px] border border-border bg-background p-4">
      <div className="flex items-start gap-3">
        <DeveloperConnectionIcon provider={row.provider} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-medium text-base text-foreground">
                {row.displayName}
              </h2>
              <p className="mt-0.5 text-muted-foreground text-sm">
                {row.description}
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-[8px] border border-border px-2 py-1 text-muted-foreground text-xs">
              <span className={cn("size-1.5 rounded-full", status.dotClass)} />
              {status.label}
            </span>
          </div>

          {connected ? (
            <div className="mt-4 flex flex-col gap-3">
              <div>
                <p className="text-foreground text-sm">
                  {row.connection?.providerAccountName}
                </p>
                {canManage ? null : (
                  <p className="mt-1 text-muted-foreground text-xs">
                    {ADMIN_REQUIRED_MESSAGE}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label
                  className="flex items-center gap-2 rounded-[8px] border border-border px-2.5 py-1.5 text-sm"
                  htmlFor={sandboxSwitchId}
                >
                  <Switch
                    aria-label="Use in sandboxes"
                    checked={row.connection?.enabledForSandboxes ?? false}
                    disabled={!canManage || pending}
                    id={sandboxSwitchId}
                    onCheckedChange={(enabled) =>
                      onSetSandboxEnabled(row.provider, enabled)
                    }
                  />
                  Use in sandboxes
                </label>
                <Button
                  disabled={pending}
                  onClick={() => onViewDetails(row.provider)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <HugeiconsIcon
                    className="mr-1.5 size-3.5"
                    icon={PanelRight}
                  />
                  Details
                </Button>
                <Button
                  disabled={!canManage || pending}
                  onClick={() => onDisconnect(row.provider)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-muted-foreground text-xs">
                {canManage ? "Not connected" : ADMIN_REQUIRED_MESSAGE}
              </p>
              <Button
                disabled={!canManage || pending}
                onClick={() => onConnect(row)}
                size="lf"
                type="button"
                variant="outline"
              >
                Connect
                <HugeiconsIcon className="size-3.5" icon={ArrowUpRight} />
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function DeveloperConnectionConnectDialog({
  onClose,
  onCompleteSentryAuth,
  onStartSentryAuth,
  onSubmit,
  row,
  sentryAuthAttempt,
}: {
  onClose: () => void;
  onCompleteSentryAuth: (attemptId: string) => void;
  onStartSentryAuth: (providerAccountName: string) => void;
  onSubmit: (input: DeveloperConnectionConnectInput) => void;
  row: DeveloperConnectionCatalogRow;
  sentryAuthAttempt: {
    attemptId: string;
    userCode: string;
    verificationUri: string;
  } | null;
}) {
  const [providerAccountName, setProviderAccountName] = useState("");
  const [serviceTokenId, setServiceTokenId] = useState("");
  const [serviceToken, setServiceToken] = useState("");
  const [email, setEmail] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [sentryToken, setSentryToken] = useState("");
  const [appId, setAppId] = useState("");
  const [instanceId, setInstanceId] = useState("");
  const [secretKey, setSecretKey] = useState("");

  function submitManual() {
    if (row.provider === "pscale") {
      onSubmit({
        provider: "pscale",
        providerAccountName,
        serviceToken,
        serviceTokenId,
      });
      return;
    }
    if (row.provider === "upstash") {
      onSubmit({
        apiKey,
        email,
        provider: "upstash",
        providerAccountName,
      });
      return;
    }
    if (row.provider === "sentry") {
      onSubmit({
        provider: "sentry",
        providerAccountName,
        token: sentryToken,
      });
      return;
    }
    onSubmit({
      appId,
      instanceId,
      provider: "clerk",
      providerAccountName,
      secretKey,
    });
  }

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect {row.displayName}</DialogTitle>
          <DialogDescription>
            Credentials are stored encrypted and only materialized inside
            Lightfast-controlled sandbox workflows.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <TextField
            id="provider-account-name"
            label="Provider account name"
            onChange={setProviderAccountName}
            value={providerAccountName}
          />

          {row.provider === "pscale" ? (
            <>
              <TextField
                id="pscale-service-token-id"
                label="Service token id"
                onChange={setServiceTokenId}
                value={serviceTokenId}
              />
              <TextField
                id="pscale-service-token"
                label="Service token"
                onChange={setServiceToken}
                type="password"
                value={serviceToken}
              />
            </>
          ) : null}

          {row.provider === "upstash" ? (
            <>
              <TextField
                id="upstash-email"
                label="Email"
                onChange={setEmail}
                type="email"
                value={email}
              />
              <TextField
                id="upstash-api-key"
                label="Management API key"
                onChange={setApiKey}
                type="password"
                value={apiKey}
              />
            </>
          ) : null}

          {row.provider === "sentry" ? (
            <>
              <div className="rounded-[9px] border border-border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">Browser OAuth</p>
                    <p className="mt-1 text-muted-foreground text-xs">
                      Preferred Sentry auth path for admin setup.
                    </p>
                  </div>
                  <Button
                    disabled={!providerAccountName}
                    onClick={() => onStartSentryAuth(providerAccountName)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <HugeiconsIcon
                      className="mr-1.5 size-3.5"
                      icon={ArrowUpRight}
                    />
                    Browser OAuth
                  </Button>
                </div>
                {sentryAuthAttempt ? (
                  <div className="mt-3 rounded-[8px] bg-muted p-3">
                    <p className="text-muted-foreground text-xs">User code</p>
                    <p className="mt-1 font-mono text-foreground text-sm">
                      {sentryAuthAttempt.userCode}
                    </p>
                    <a
                      className="mt-2 inline-flex text-primary text-xs underline"
                      href={sentryAuthAttempt.verificationUri}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open Sentry authorization
                    </a>
                    <Button
                      className="mt-3"
                      onClick={() =>
                        onCompleteSentryAuth(sentryAuthAttempt.attemptId)
                      }
                      size="sm"
                      type="button"
                    >
                      Complete connection
                    </Button>
                  </div>
                ) : null}
              </div>
              <TextField
                id="sentry-token"
                label="Sentry token"
                onChange={setSentryToken}
                type="password"
                value={sentryToken}
              />
            </>
          ) : null}

          {row.provider === "clerk" ? (
            <>
              <TextField
                id="clerk-app-id"
                label="App id"
                onChange={setAppId}
                value={appId}
              />
              <TextField
                id="clerk-instance-id"
                label="Instance id"
                onChange={setInstanceId}
                value={instanceId}
              />
              <TextField
                id="clerk-secret-key"
                label="Instance secret key"
                onChange={setSecretKey}
                type="password"
                value={secretKey}
              />
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button onClick={submitManual} type="button">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TextField({
  id,
  label,
  onChange,
  type = "text",
  value,
}: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        onChange={(event) => onChange(event.currentTarget.value)}
        type={type}
        value={value}
      />
    </div>
  );
}
