import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createOrgApiKeyMutationOptions } from "./org-api-key-queries";

export function useOrgApiKeyCreateAction({
  onCreated,
}: {
  onCreated: (key: string | null) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation(
    createOrgApiKeyMutationOptions({
      onCreated,
      queryClient,
    })
  );
}
