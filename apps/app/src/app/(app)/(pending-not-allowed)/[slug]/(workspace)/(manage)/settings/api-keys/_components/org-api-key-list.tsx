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
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { toast } from "@repo/ui/components/ui/sonner";
import {
  type QueryKey,
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useAuth } from "@vendor/clerk";
import { formatRelativeTimeToNow } from "@vendor/lib/time";
import { Key, MoreHorizontal, ShieldOff, Trash2 } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { useTRPC } from "~/trpc/react";
import {
  type OrgApiKey,
  type OrgApiKeyListData,
  removeApiKey,
  restoreApiKey,
  revokeApiKey,
} from "./org-api-key-cache";
import { getOrgApiKeyRowModel } from "./org-api-key-row-model";

interface AlertAction {
  keyId: string;
  keyName: string;
  type: "revoke" | "delete";
}

function useOrgApiKeyListActions(listQueryKey: QueryKey) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const invalidateList = useCallback(
    () => queryClient.invalidateQueries({ queryKey: listQueryKey }),
    [queryClient, listQueryKey]
  );

  const revokeMutation = useMutation(
    trpc.org.settings.orgApiKeys.revoke.mutationOptions({
      meta: { errorTitle: "Failed to revoke API key" },
      onMutate: async (input) => {
        await queryClient.cancelQueries({ queryKey: listQueryKey });

        const previous =
          queryClient.getQueryData<OrgApiKeyListData>(listQueryKey);
        const previousApiKey = previous?.find(
          (key) => key.keyId === input.keyId
        );

        queryClient.setQueryData(
          listQueryKey,
          (old: OrgApiKeyListData | undefined) => revokeApiKey(old, input.keyId)
        );

        return { previousApiKey };
      },
      onError: (_err, _input, context) => {
        if (!context?.previousApiKey) {
          return;
        }

        queryClient.setQueryData(
          listQueryKey,
          (old: OrgApiKeyListData | undefined) =>
            restoreApiKey(old, context.previousApiKey, -1)
        );
      },
      onSuccess: () => toast.success("API key revoked"),
      onSettled: () => void invalidateList(),
    })
  );

  const deleteMutation = useMutation(
    trpc.org.settings.orgApiKeys.delete.mutationOptions({
      meta: { errorTitle: "Failed to delete API key" },
      onMutate: async (input) => {
        await queryClient.cancelQueries({ queryKey: listQueryKey });

        const previous =
          queryClient.getQueryData<OrgApiKeyListData>(listQueryKey);
        const { removedApiKey, removedIndex } = removeApiKey(
          previous,
          input.keyId
        );

        queryClient.setQueryData(
          listQueryKey,
          (old: OrgApiKeyListData | undefined) =>
            removeApiKey(old, input.keyId).data
        );

        return { removedApiKey, removedIndex };
      },
      onError: (_err, _input, context) => {
        if (!context?.removedApiKey) {
          return;
        }

        queryClient.setQueryData(
          listQueryKey,
          (old: OrgApiKeyListData | undefined) =>
            restoreApiKey(old, context.removedApiKey, context.removedIndex)
        );
      },
      onSuccess: () => toast.success("API key deleted"),
      onSettled: () => void invalidateList(),
    })
  );

  const revokeKey = useCallback(
    (keyId: string) => revokeMutation.mutate({ keyId }),
    [revokeMutation.mutate]
  );
  const deleteKey = useCallback(
    (keyId: string) => deleteMutation.mutate({ keyId }),
    [deleteMutation.mutate]
  );

  return {
    actionsDisabled: revokeMutation.isPending || deleteMutation.isPending,
    deleteKey,
    pendingDeleteKeyId: deleteMutation.variables?.keyId,
    pendingRevokeKeyId: revokeMutation.variables?.keyId,
    revokeKey,
  };
}

export function OrgApiKeyList() {
  const { has, isLoaded } = useAuth();
  const canManageApiKeys = isLoaded && !!has?.({ role: "org:admin" });
  const trpc = useTRPC();
  const listQueryOptions = useMemo(
    () => trpc.org.settings.orgApiKeys.list.queryOptions(),
    [trpc]
  );
  const listQueryKey = listQueryOptions.queryKey;

  const { data: keys } = useSuspenseQuery({
    ...listQueryOptions,
    staleTime: 5 * 60 * 1000,
  });
  const {
    actionsDisabled,
    deleteKey,
    pendingDeleteKeyId,
    pendingRevokeKeyId,
    revokeKey,
  } = useOrgApiKeyListActions(listQueryKey);

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
              actionsDisabled={actionsDisabled}
              canManageApiKeys={canManageApiKeys}
              key={key.keyId}
              keyItem={key}
              onRequestDelete={handleRequestDelete}
              onRequestRevoke={handleRequestRevoke}
              pendingDeleteKeyId={pendingDeleteKeyId}
              pendingRevokeKeyId={pendingRevokeKeyId}
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
  actionsDisabled,
  canManageApiKeys,
  keyItem,
  onRequestDelete,
  onRequestRevoke,
  pendingDeleteKeyId,
  pendingRevokeKeyId,
}: {
  actionsDisabled: boolean;
  canManageApiKeys: boolean;
  keyItem: OrgApiKey;
  onRequestDelete: (keyId: string, keyName: string) => void;
  onRequestRevoke: (keyId: string, keyName: string) => void;
  pendingDeleteKeyId?: string;
  pendingRevokeKeyId?: string;
}) {
  const { isActive, isExpired, isPending, keyName } = getOrgApiKeyRowModel(
    keyItem,
    {
      pendingDeleteKeyId,
      pendingRevokeKeyId,
    }
  );

  return (
    <div
      className={`flex items-center justify-between border-border/60 border-b px-4 py-4 last:border-b-0 ${
        isPending ? "opacity-60" : ""
      } ${isActive ? "" : "opacity-50"}`}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm">{keyName}</p>
          {!keyItem.enabled && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
              Revoked
            </span>
          )}
          {isExpired && keyItem.enabled && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
              Expired
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-muted-foreground text-xs">
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
              disabled={actionsDisabled}
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
