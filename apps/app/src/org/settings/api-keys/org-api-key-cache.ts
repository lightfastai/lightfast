import type { ListOrgApiKeysResult } from "@api/app/tanstack/org-api-keys";

export type OrgApiKeyListData = ListOrgApiKeysResult;
export type OrgApiKey = OrgApiKeyListData[number];

export const orgApiKeyListQueryKey = ["org-api-keys", "list"] as const;

function insertAt<T>(items: T[], item: T, index: number) {
  const next = [...items];
  next.splice(Math.max(0, Math.min(index, next.length)), 0, item);
  return next;
}

export function revokeApiKey(
  data: OrgApiKeyListData | undefined,
  keyId: string
): OrgApiKeyListData | undefined {
  if (!data) {
    return data;
  }

  return data.map((key) =>
    key.keyId === keyId ? { ...key, enabled: false } : key
  );
}

export function removeApiKey(
  data: OrgApiKeyListData | undefined,
  keyId: string
): {
  data: OrgApiKeyListData | undefined;
  removedApiKey: OrgApiKey | undefined;
  removedIndex: number;
} {
  if (!data) {
    return { data, removedApiKey: undefined, removedIndex: -1 };
  }

  const removedIndex = data.findIndex((key) => key.keyId === keyId);
  if (removedIndex === -1) {
    return { data, removedApiKey: undefined, removedIndex };
  }

  const removedApiKey = data[removedIndex];
  return {
    data: data.filter((key) => key.keyId !== keyId),
    removedApiKey,
    removedIndex,
  };
}

export function restoreApiKey(
  data: OrgApiKeyListData | undefined,
  apiKey: OrgApiKey | undefined,
  index: number
): OrgApiKeyListData | undefined {
  if (!(data && apiKey)) {
    return data;
  }

  const existingIndex = data.findIndex((key) => key.keyId === apiKey.keyId);
  if (existingIndex !== -1) {
    return data.map((key) => (key.keyId === apiKey.keyId ? apiKey : key));
  }

  return insertAt(data, apiKey, index);
}
