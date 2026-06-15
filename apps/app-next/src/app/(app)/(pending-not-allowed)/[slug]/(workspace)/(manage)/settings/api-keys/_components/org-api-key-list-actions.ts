"use client";

import { toast } from "@repo/ui/components/ui/sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useTRPC } from "~/trpc/react";
import {
  type OrgApiKeyListData,
  removeApiKey,
  restoreApiKey,
  revokeApiKey,
} from "./org-api-key-cache";

export function useOrgApiKeyListActions() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const revokeMutation = useMutation(
    trpc.org.settings.orgApiKeys.revoke.mutationOptions({
      meta: { errorTitle: "Failed to revoke API key" },
      onMutate: async (input) => {
        await queryClient.cancelQueries(
          trpc.org.settings.orgApiKeys.list.queryFilter()
        );

        const previous = queryClient.getQueryData<OrgApiKeyListData>(
          trpc.org.settings.orgApiKeys.list.queryKey()
        );
        const previousApiKey = previous?.find(
          (key) => key.keyId === input.keyId
        );

        queryClient.setQueryData(
          trpc.org.settings.orgApiKeys.list.queryKey(),
          (old: OrgApiKeyListData | undefined) => revokeApiKey(old, input.keyId)
        );

        return { previousApiKey };
      },
      onError: (_err, _input, context) => {
        if (!context?.previousApiKey) {
          return;
        }

        queryClient.setQueryData(
          trpc.org.settings.orgApiKeys.list.queryKey(),
          (old: OrgApiKeyListData | undefined) =>
            restoreApiKey(old, context.previousApiKey, -1)
        );
      },
      onSuccess: () => toast.success("API key revoked"),
      onSettled: () =>
        void queryClient.invalidateQueries(
          trpc.org.settings.orgApiKeys.list.queryFilter()
        ),
    })
  );

  const deleteMutation = useMutation(
    trpc.org.settings.orgApiKeys.delete.mutationOptions({
      meta: { errorTitle: "Failed to delete API key" },
      onMutate: async (input) => {
        await queryClient.cancelQueries(
          trpc.org.settings.orgApiKeys.list.queryFilter()
        );

        const previous = queryClient.getQueryData<OrgApiKeyListData>(
          trpc.org.settings.orgApiKeys.list.queryKey()
        );
        const { removedApiKey, removedIndex } = removeApiKey(
          previous,
          input.keyId
        );

        queryClient.setQueryData(
          trpc.org.settings.orgApiKeys.list.queryKey(),
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
          trpc.org.settings.orgApiKeys.list.queryKey(),
          (old: OrgApiKeyListData | undefined) =>
            restoreApiKey(old, context.removedApiKey, context.removedIndex)
        );
      },
      onSuccess: () => toast.success("API key deleted"),
      onSettled: () =>
        void queryClient.invalidateQueries(
          trpc.org.settings.orgApiKeys.list.queryFilter()
        ),
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
    deleteKey,
    pendingDeleteKeyId: deleteMutation.isPending
      ? deleteMutation.variables?.keyId
      : undefined,
    pendingRevokeKeyId: revokeMutation.isPending
      ? revokeMutation.variables?.keyId
      : undefined,
    revokeKey,
  };
}
