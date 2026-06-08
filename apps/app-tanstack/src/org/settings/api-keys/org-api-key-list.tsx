import { useAuth } from "@clerk/tanstack-react-start";
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
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { formatRelativeTimeToNow } from "@vendor/lib/time";
import { Key, MoreHorizontal, ShieldOff, Trash2 } from "lucide-react";
import { memo, useCallback, useState } from "react";
import { useTRPC } from "~/trpc/react";
import type { OrgApiKey } from "./org-api-key-cache";
import { useOrgApiKeyListActions } from "./org-api-key-list-actions";

interface AlertAction {
  keyId: string;
  keyName: string;
  type: "revoke" | "delete";
}

export function OrgApiKeyList() {
  const { has, isLoaded } = useAuth();
  const canManageApiKeys = isLoaded && !!has?.({ role: "org:admin" });
  const trpc = useTRPC();

  const {
    data: keys = [],
    error,
    isPending,
  } = useQuery({
    ...trpc.org.settings.orgApiKeys.list.queryOptions(),
    enabled: typeof window !== "undefined",
    staleTime: 5 * 60 * 1000,
  });
  const { deleteKey, pendingDeleteKeyId, pendingRevokeKeyId, revokeKey } =
    useOrgApiKeyListActions();

  const [alertAction, setAlertAction] = useState<AlertAction | null>(null);

  const handleRequestRevoke = useCallback((keyId: string, keyName: string) => {
    setAlertAction({ keyId, keyName, type: "revoke" });
  }, []);

  const handleRequestDelete = useCallback((keyId: string, keyName: string) => {
    setAlertAction({ keyId, keyName, type: "delete" });
  }, []);

  const handleConfirmAlert = useCallback(() => {
    if (!alertAction) {
      return;
    }
    switch (alertAction.type) {
      case "revoke":
        revokeKey(alertAction.keyId);
        break;
      case "delete":
        deleteKey(alertAction.keyId);
        break;
      default:
        break;
    }
    setAlertAction(null);
  }, [alertAction, deleteKey, revokeKey]);

  if (isPending) {
    return (
      <div className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            className="flex items-center justify-between gap-4 px-4 py-4"
            key={index}
          >
            <div className="space-y-2">
              <div className="h-4 w-40 rounded bg-muted" />
              <div className="h-3 w-64 rounded bg-muted" />
            </div>
            <div className="size-6 rounded-md bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[12px] border border-destructive/30 bg-destructive/5 p-4 text-destructive text-sm">
        {error.message}
      </div>
    );
  }

  return (
    <>
      {keys.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-border/50 py-16 text-center">
          <div className="mb-4 rounded-full bg-muted/20 p-3">
            <Key className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-semibold text-sm">No API keys yet</p>
          <p className="mt-1 max-w-sm text-muted-foreground text-sm">
            {canManageApiKeys
              ? "Create an API key to access your organization's resources programmatically."
              : "Ask an organization admin to create API keys."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/60">
          {keys.map((key) => (
            <OrgApiKeyRow
              canManageApiKeys={canManageApiKeys}
              isPending={
                pendingRevokeKeyId === key.keyId ||
                pendingDeleteKeyId === key.keyId
              }
              key={key.keyId}
              keyItem={key}
              onRequestDelete={handleRequestDelete}
              onRequestRevoke={handleRequestRevoke}
            />
          ))}
        </div>
      )}

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setAlertAction(null);
          }
        }}
        open={!!alertAction}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {alertAction?.type === "revoke" && "Revoke API Key?"}
              {alertAction?.type === "delete" && "Delete API Key?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {alertAction?.type === "revoke" &&
                `"${alertAction.keyName}" will be deactivated immediately. Any requests using this key will fail.`}
              {alertAction?.type === "delete" &&
                `"${alertAction.keyName}" will be permanently deleted. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={
                alertAction?.type === "delete"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
              onClick={handleConfirmAlert}
            >
              {alertAction?.type === "revoke" && "Revoke"}
              {alertAction?.type === "delete" && "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

const OrgApiKeyRow = memo(function OrgApiKeyRow({
  canManageApiKeys,
  isPending,
  keyItem,
  onRequestDelete,
  onRequestRevoke,
}: {
  canManageApiKeys: boolean;
  isPending: boolean;
  keyItem: OrgApiKey;
  onRequestDelete: (keyId: string, keyName: string) => void;
  onRequestRevoke: (keyId: string, keyName: string) => void;
}) {
  const isExpired =
    typeof keyItem.expires === "number" && keyItem.expires <= Date.now();
  const isActive = keyItem.enabled && !isExpired;
  const keyName = keyItem.name ?? keyItem.start;

  return (
    <div
      className={`flex flex-col gap-3 border-border/60 border-b px-4 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between ${
        isPending ? "opacity-60" : ""
      } ${isActive ? "" : "opacity-50"}`}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm">{keyName}</p>
          {!keyItem.enabled && <Badge variant="secondary">Revoked</Badge>}
          {isExpired && keyItem.enabled && (
            <Badge variant="secondary">Expired</Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground text-xs">
          <code className="font-mono">{keyItem.start}</code>
          <span>
            Created{" "}
            {formatRelativeTimeToNow(keyItem.createdAt, {
              addSuffix: true,
            })}
          </span>
          {keyItem.lastUsedAt && (
            <span>
              Last used{" "}
              {formatRelativeTimeToNow(keyItem.lastUsedAt, {
                addSuffix: true,
              })}
            </span>
          )}
          {keyItem.expires && (
            <span>
              Expires{" "}
              {formatRelativeTimeToNow(keyItem.expires, {
                addSuffix: true,
              })}
            </span>
          )}
        </div>
      </div>

      {canManageApiKeys ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="text-muted-foreground hover:text-foreground"
              disabled={isPending}
              onClick={(e) => e.stopPropagation()}
              size="icon-sm"
              variant="ghost"
            >
              <MoreHorizontal className="size-3.5" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="space-y-1">
            {isActive && (
              <DropdownMenuItem
                className="cursor-pointer rounded-xl px-2"
                onClick={() => onRequestRevoke(keyItem.keyId, keyName)}
              >
                <ShieldOff />
                Revoke
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="cursor-pointer rounded-xl px-2"
              onClick={() => onRequestDelete(keyItem.keyId, keyName)}
              variant="destructive"
            >
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="size-6" />
      )}
    </div>
  );
});
