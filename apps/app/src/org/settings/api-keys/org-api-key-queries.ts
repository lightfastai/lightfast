import {
  createOrgApiKey,
  deleteOrgApiKey,
  type ListOrgApiKeysResult,
  listOrgApiKeys,
  revokeOrgApiKey,
  rotateOrgApiKey,
} from "@api/app/tanstack/org-api-keys";
import type {
  createOrgApiKeySchema,
  deleteOrgApiKeySchema,
  revokeOrgApiKeySchema,
  rotateOrgApiKeySchema,
} from "@repo/app-validation/schemas";
import {
  mutationOptions,
  type QueryClient,
  queryOptions,
} from "@tanstack/react-query";
import type { z } from "zod";

export type OrgApiKeyListData = ListOrgApiKeysResult;
export type OrgApiKey = OrgApiKeyListData[number];
type CreateOrgApiKeyInput = z.infer<typeof createOrgApiKeySchema>;
type RevokeOrgApiKeyInput = z.infer<typeof revokeOrgApiKeySchema>;
type DeleteOrgApiKeyInput = z.infer<typeof deleteOrgApiKeySchema>;
type RotateOrgApiKeyInput = z.input<typeof rotateOrgApiKeySchema>;

export const orgApiKeyQueryKeys = {
  all: ["org-api-keys"] as const,
  list: () => ["org-api-keys", "list"] as const,
};

export function orgApiKeysQueryOptions() {
  return queryOptions({
    enabled: typeof window !== "undefined",
    queryFn: () => listOrgApiKeys(),
    queryKey: orgApiKeyQueryKeys.list(),
    staleTime: 5 * 60 * 1000,
  });
}

export function createOrgApiKeyMutationOptions(input: {
  onCreated: (key: string | null) => void;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    meta: { errorTitle: "Failed to create API key" },
    mutationFn: (data: CreateOrgApiKeyInput) => createOrgApiKey({ data }),
    onSuccess: (data) => {
      input.onCreated(data.key ?? null);
      void input.queryClient.invalidateQueries({
        queryKey: orgApiKeyQueryKeys.list(),
      });
    },
  });
}

export function revokeOrgApiKeyMutationOptions() {
  return mutationOptions({
    meta: { errorTitle: "Failed to revoke API key" },
    mutationFn: (data: RevokeOrgApiKeyInput) => revokeOrgApiKey({ data }),
  });
}

export function deleteOrgApiKeyMutationOptions() {
  return mutationOptions({
    meta: { errorTitle: "Failed to delete API key" },
    mutationFn: (data: DeleteOrgApiKeyInput) => deleteOrgApiKey({ data }),
  });
}

export function rotateOrgApiKeyMutationOptions() {
  return mutationOptions({
    meta: { errorTitle: "Failed to rotate API key" },
    mutationFn: (data: RotateOrgApiKeyInput) => rotateOrgApiKey({ data }),
  });
}
