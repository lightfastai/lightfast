"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";

export function useOrgApiKeyCreateAction({
  onCreated,
}: {
  onCreated: (key: string | null) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.org.settings.orgApiKeys.create.mutationOptions({
      meta: { errorTitle: "Failed to create API key" },
      onSuccess: (data) => {
        onCreated(data.key ?? null);
        void queryClient.invalidateQueries(
          trpc.org.settings.orgApiKeys.list.queryFilter()
        );
      },
    })
  );
}
