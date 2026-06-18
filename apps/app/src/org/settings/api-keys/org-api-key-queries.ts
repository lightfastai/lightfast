import {
  type ListOrgApiKeysResult,
  listOrgApiKeys,
} from "@api/app/tanstack/org-api-keys";
import { queryOptions } from "@tanstack/react-query";

export type OrgApiKeyListData = ListOrgApiKeysResult;
export type OrgApiKey = OrgApiKeyListData[number];

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
