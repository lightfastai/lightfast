"use client";

import { useTRPC } from "@repo/app-trpc/react";
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
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useAuth } from "@vendor/clerk";
import { formatRelativeTimeToNow } from "@vendor/lib/time";
import { Key, MoreHorizontal, ShieldOff, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import {
  type OrgApiKeyListData,
  removeApiKey,
  restoreApiKey,
  revokeApiKey,
} from "./org-api-key-cache";

export function OrgApiKeyList() {
  const { has, isLoaded } = useAuth();
  const canManageApiKeys = isLoaded && !!has?.({ role: "org:admin" });
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const listQueryOptions = trpc.org.settings.orgApiKeys.list.queryOptions();
  const listQueryKey = listQueryOptions.queryKey;

  const { data: keys } = useSuspenseQuery({
    ...listQueryOptions,
    staleTime: 5 * 60 * 1000,
  });

  const [alertAction, setAlertAction] = useState<{
    type: "revoke" | "delete";
    keyId: string;
    keyName: string;
  } | null>(null);

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
        const previousApiKey = previous?.find((key) => key.id === input.keyId);

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

  function handleConfirmAlert() {
    if (!alertAction) {
      return;
    }
    switch (alertAction.type) {
      case "revoke":
        revokeMutation.mutate({ keyId: alertAction.keyId });
        break;
      case "delete":
        deleteMutation.mutate({ keyId: alertAction.keyId });
        break;
      default:
        break;
    }
    setAlertAction(null);
  }

  const actionsDisabled = revokeMutation.isPending || deleteMutation.isPending;

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
          {keys.map((key) => {
            const isPending =
              (revokeMutation.isPending &&
                revokeMutation.variables?.keyId === key.id) ||
              (deleteMutation.isPending &&
                deleteMutation.variables?.keyId === key.id);
            const isActive = !(key.revoked || key.expired);

            return (
              <div
                className={`flex items-center justify-between border-border/60 border-b px-4 py-4 last:border-b-0 ${
                  isPending ? "opacity-60" : ""
                } ${isActive ? "" : "opacity-50"}`}
                key={key.id}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{key.name}</p>
                    {key.revoked && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
                        Revoked
                      </span>
                    )}
                    {key.expired && !key.revoked && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
                        Expired
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground text-xs">
                    <code className="font-mono">{`${key.id.slice(0, 11)}…`}</code>
                    <span>
                      Created{" "}
                      {formatRelativeTimeToNow(key.createdAt, {
                        addSuffix: true,
                      })}
                    </span>
                    {key.lastUsedAt && (
                      <span>
                        Last used{" "}
                        {formatRelativeTimeToNow(key.lastUsedAt, {
                          addSuffix: true,
                        })}
                      </span>
                    )}
                    {key.expiration && (
                      <span>
                        Expires{" "}
                        {formatRelativeTimeToNow(key.expiration, {
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
                          onClick={() =>
                            setAlertAction({
                              type: "revoke",
                              keyId: key.id,
                              keyName: key.name,
                            })
                          }
                        >
                          <ShieldOff />
                          Revoke
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="cursor-pointer rounded-xl px-2"
                        onClick={() =>
                          setAlertAction({
                            type: "delete",
                            keyId: key.id,
                            keyName: key.name,
                          })
                        }
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
          })}
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
