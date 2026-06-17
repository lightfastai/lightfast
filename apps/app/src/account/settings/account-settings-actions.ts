import { toast } from "@repo/ui/components/ui/sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  accountQueryKeys,
  updateAccountNameMutationOptions,
} from "../account-queries";

export function useAccountNameUpdate() {
  const queryClient = useQueryClient();

  const updateNameMutation = useMutation({
    ...updateAccountNameMutationOptions(),
    onSuccess: (data) => {
      queryClient.setQueryData(accountQueryKeys.profile(), data);
      toast.success("Profile updated", {
        description: `Display name changed to "${data.fullName ?? ""}"`,
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: accountQueryKeys.profile(),
      });
    },
  });

  const updateDisplayName = useCallback(
    (displayName: string) => updateNameMutation.mutate({ displayName }),
    [updateNameMutation.mutate]
  );

  return {
    isUpdating: updateNameMutation.isPending,
    updateDisplayName,
  };
}
