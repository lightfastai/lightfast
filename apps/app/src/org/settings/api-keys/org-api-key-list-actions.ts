import { toast } from "@repo/ui/components/ui/sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  type OrgApiKeyListData,
  removeApiKey,
  restoreApiKey,
  revokeApiKey,
} from "./org-api-key-cache";
import {
  deleteOrgApiKeyMutationOptions,
  orgApiKeyQueryKeys,
  revokeOrgApiKeyMutationOptions,
  rotateOrgApiKeyMutationOptions,
} from "./org-api-key-queries";

export function useOrgApiKeyListActions({
  onRotated,
}: {
  onRotated?: (input: { key: string | null; keyId: string }) => void;
} = {}) {
  const queryClient = useQueryClient();
  const listQueryKey = orgApiKeyQueryKeys.list();

  const revokeMutation = useMutation({
    ...revokeOrgApiKeyMutationOptions(),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: listQueryKey });

      const previous =
        queryClient.getQueryData<OrgApiKeyListData>(listQueryKey);
      const previousApiKey = previous?.find((key) => key.keyId === input.keyId);

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
    onSettled: () =>
      void queryClient.invalidateQueries({ queryKey: listQueryKey }),
  });

  const deleteMutation = useMutation({
    ...deleteOrgApiKeyMutationOptions(),
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
    onSettled: () =>
      void queryClient.invalidateQueries({ queryKey: listQueryKey }),
  });

  const rotateMutation = useMutation({
    ...rotateOrgApiKeyMutationOptions(),
    onSuccess: (data, input) => {
      onRotated?.({ key: data.key ?? null, keyId: input.keyId });
      toast.success("API key rotated");
    },
    onSettled: () =>
      void queryClient.invalidateQueries({ queryKey: listQueryKey }),
  });

  const revokeKey = useCallback(
    (keyId: string) => revokeMutation.mutate({ keyId }),
    [revokeMutation.mutate]
  );
  const deleteKey = useCallback(
    (keyId: string) => deleteMutation.mutate({ keyId }),
    [deleteMutation.mutate]
  );
  const rotateKey = useCallback(
    (keyId: string) => rotateMutation.mutate({ keyId }),
    [rotateMutation.mutate]
  );

  return {
    deleteKey,
    pendingDeleteKeyId: deleteMutation.isPending
      ? deleteMutation.variables?.keyId
      : undefined,
    pendingRevokeKeyId: revokeMutation.isPending
      ? revokeMutation.variables?.keyId
      : undefined,
    pendingRotateKeyId: rotateMutation.isPending
      ? rotateMutation.variables?.keyId
      : undefined,
    revokeKey,
    rotateKey,
  };
}
