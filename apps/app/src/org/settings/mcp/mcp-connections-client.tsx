import {
  type ListOrgMcpConnectionsResult,
  listOrgMcpConnections,
  revokeOrgMcpConnection,
} from "@api/app/tanstack/mcp-connections";
import {
  InformationCircleIcon as Info,
  SecurityCheckIcon as ShieldCheck,
  ShieldQuestionMarkIcon as ShieldQuestion,
  Unlink02Icon as Unplug,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/ui/sheet";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { toast } from "@repo/ui/components/ui/sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatRelativeTimeToNow } from "@vendor/lib/time";
import { useCallback, useState } from "react";

type McpConnection = ListOrgMcpConnectionsResult[number];

const orgMcpConnectionListQueryKey = ["org-mcp-connections", "list"] as const;

export function McpConnectionsClient() {
  const queryClient = useQueryClient();
  const {
    data: connections,
    error,
    isPending,
  } = useQuery({
    enabled: typeof window !== "undefined",
    queryFn: () => listOrgMcpConnections(),
    queryKey: orgMcpConnectionListQueryKey,
  });
  const [detailsConnection, setDetailsConnection] =
    useState<McpConnection | null>(null);
  const [revokeConnection, setRevokeConnection] =
    useState<McpConnection | null>(null);

  const revokeMutation = useMutation({
    meta: { errorTitle: "Failed to revoke MCP connection" },
    mutationFn: (data: { grantId: string }) => revokeOrgMcpConnection({ data }),
    onSuccess: () => toast.success("MCP connection revoked"),
    onSettled: () =>
      void queryClient.invalidateQueries({
        queryKey: orgMcpConnectionListQueryKey,
      }),
  });

  const handleConfirmRevoke = useCallback(() => {
    if (!revokeConnection) {
      return;
    }
    revokeMutation.mutate({ grantId: revokeConnection.grantId });
    setRevokeConnection(null);
  }, [revokeConnection, revokeMutation.mutate]);

  return (
    <>
      {isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-20 rounded-md" />
          <Skeleton className="h-20 rounded-md" />
        </div>
      ) : error ? (
        <div className="rounded-[12px] border border-destructive/30 bg-destructive/5 p-4 text-destructive text-sm">
          {error.message}
        </div>
      ) : (
        <McpConnectionsList
          connections={(connections ?? []) as McpConnection[]}
          isRevokingGrantId={
            revokeMutation.isPending ? revokeMutation.variables?.grantId : null
          }
          onDetails={setDetailsConnection}
          onRevoke={setRevokeConnection}
          showConnectedUser
        />
      )}

      {detailsConnection ? (
        <McpConnectionDetailsSheet
          connection={detailsConnection}
          onOpenChange={(open) => {
            if (!open) {
              setDetailsConnection(null);
            }
          }}
        />
      ) : null}

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setRevokeConnection(null);
          }
        }}
        open={!!revokeConnection}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke MCP connection?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeConnection?.clientName} will lose access immediately.
              Existing refresh tokens for this grant will no longer be trusted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRevoke}>
              Revoke connection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function McpConnectionsList({
  connections,
  isRevokingGrantId,
  onDetails,
  onRevoke,
  showConnectedUser,
}: {
  connections: McpConnection[];
  isRevokingGrantId?: string | null;
  onDetails: (connection: McpConnection) => void;
  onRevoke: (connection: McpConnection) => void;
  showConnectedUser?: boolean;
}) {
  if (connections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border border-border/50 py-16 text-center">
        <div className="mb-4 rounded-full bg-muted/20 p-3">
          <HugeiconsIcon
            className="size-5 text-muted-foreground"
            icon={Unplug}
          />
        </div>
        <p className="font-medium text-sm">No MCP connections</p>
        <p className="mt-1 max-w-md text-muted-foreground text-sm">
          Approved MCP clients for this organization will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border/60">
      {connections.map((connection) => (
        <McpConnectionRow
          connection={connection}
          isRevoking={isRevokingGrantId === connection.grantId}
          key={connection.grantId}
          onDetails={onDetails}
          onRevoke={onRevoke}
          showConnectedUser={showConnectedUser}
        />
      ))}
    </div>
  );
}

function McpConnectionRow({
  connection,
  isRevoking,
  onDetails,
  onRevoke,
  showConnectedUser,
}: {
  connection: McpConnection;
  isRevoking: boolean;
  onDetails: (connection: McpConnection) => void;
  onRevoke: (connection: McpConnection) => void;
  showConnectedUser?: boolean;
}) {
  const isActive = connection.status === "active";

  return (
    <div
      className={`flex flex-col gap-4 border-border/60 border-b px-4 py-4 last:border-b-0 md:flex-row md:items-center md:justify-between ${
        isActive ? "" : "opacity-55"
      }`}
    >
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-sm">{connection.clientName}</p>
          <VerificationBadge status={connection.clientVerificationStatus} />
          {isActive ? null : <Badge variant="secondary">Revoked</Badge>}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs">
          {showConnectedUser ? <span>{connection.connectedUserId}</span> : null}
          <span>{permissionSummary(connection.scopes)}</span>
          <span>Connected {relativeTime(connection.createdAt)}</span>
          {connection.lastUsedAt ? (
            <span>Last used {relativeTime(connection.lastUsedAt)}</span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          aria-label={`Details for ${connection.clientName}`}
          onClick={() => onDetails(connection)}
          size="sm"
          variant="outline"
        >
          <HugeiconsIcon className="size-3.5" icon={Info} />
          Details
        </Button>
        {isActive ? (
          <Button
            aria-label={`Revoke ${connection.clientName}`}
            disabled={isRevoking}
            onClick={() => onRevoke(connection)}
            size="sm"
            variant="destructive"
          >
            <HugeiconsIcon className="size-3.5" icon={Unplug} />
            Revoke
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function VerificationBadge({
  status,
}: {
  status: McpConnection["clientVerificationStatus"];
}) {
  if (status === "verified") {
    return (
      <Badge className="gap-1" variant="secondary">
        <HugeiconsIcon className="size-3" icon={ShieldCheck} />
        Verified
      </Badge>
    );
  }
  return (
    <Badge className="gap-1" variant="outline">
      <HugeiconsIcon className="size-3" icon={ShieldQuestion} />
      Unverified
    </Badge>
  );
}

function McpConnectionDetailsSheet({
  connection,
  onOpenChange,
}: {
  connection: McpConnection;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet onOpenChange={onOpenChange} open>
      <SheetContent className="overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{connection.clientName}</SheetTitle>
          <SheetDescription>MCP OAuth connection details</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-6">
          <DetailsBlock
            rows={[
              ["Client ID", connection.clientId],
              ["Grant ID", connection.grantId],
              ["Resource", connection.resource],
              ["Client URI", connection.clientUri ?? "Not provided"],
              ["Policy URI", connection.clientPolicyUri ?? "Not provided"],
            ]}
          />
          <DetailsBlock
            rows={[
              ["Scopes", connection.scopes.join(" ")],
              ["Redirect URI", connection.redirectUris.join("\n") || "None"],
              ["Token status", tokenStatusSummary(connection)],
            ]}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailsBlock({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="space-y-3 text-sm">
      {rows.map(([label, value]) => (
        <div className="grid gap-1" key={label}>
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="whitespace-pre-wrap break-words font-mono text-foreground text-xs">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function permissionSummary(scopes: string[]): string {
  const canReadDecisions = scopes.includes("mcp:decisions:read");
  const canReadSignals = scopes.includes("mcp:signals:read");
  const canWriteSignals = scopes.includes("mcp:signals:write");
  if (canReadDecisions && (canReadSignals || canWriteSignals)) {
    return "Signals and decisions";
  }
  if (canReadDecisions) {
    return "Read decisions";
  }
  if (canReadSignals && canWriteSignals) {
    return "Read and write signals";
  }
  if (canReadSignals) {
    return "Read signals";
  }
  if (canWriteSignals) {
    return "Write signals";
  }
  return scopes.includes("mcp:system:read") ? "System access" : "No scopes";
}

function tokenStatusSummary(connection: McpConnection): string {
  const summary = connection.refreshTokenStatusSummary;
  return `${summary.active} active, ${summary.rotated} rotated, ${summary.revoked} revoked, ${summary.reuseDetected} reuse detected`;
}

function relativeTime(value: string): string {
  return formatRelativeTimeToNow(new Date(value), { addSuffix: true });
}
