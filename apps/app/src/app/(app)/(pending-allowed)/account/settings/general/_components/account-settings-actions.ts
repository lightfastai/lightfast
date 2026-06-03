"use client";

import { toast } from "@repo/ui/components/ui/sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useTRPC } from "~/trpc/react";

export function useAccountNameUpdate() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const updateNameMutation = useMutation(
    trpc.viewer.account.updateName.mutationOptions({
      meta: { errorTitle: "Failed to update display name" },
      onSuccess: (data) => {
        queryClient.setQueryData(trpc.viewer.account.get.queryKey(), data);
        toast.success("Profile updated", {
          description: `Display name changed to "${data.fullName ?? ""}"`,
        });
      },
      onSettled: () => {
        void queryClient.invalidateQueries(
          trpc.viewer.account.get.queryFilter()
        );
      },
    })
  );

  const updateDisplayName = useCallback(
    (displayName: string) => updateNameMutation.mutate({ displayName }),
    [updateNameMutation.mutate]
  );

  return {
    isUpdating: updateNameMutation.isPending,
    updateDisplayName,
  };
}
