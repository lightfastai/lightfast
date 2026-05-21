import type { AppRouterOutputs } from "@api/app";

export type OrgApiKeyListData =
  AppRouterOutputs["pendingNotAllowed"]["orgApiKeys"]["list"];
export type OrgApiKey = OrgApiKeyListData[number];

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
    key.id === keyId ? { ...key, revoked: true } : key
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

  const removedIndex = data.findIndex((key) => key.id === keyId);
  if (removedIndex === -1) {
    return { data, removedApiKey: undefined, removedIndex };
  }

  const removedApiKey = data[removedIndex];
  return {
    data: data.filter((key) => key.id !== keyId),
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

  const existingIndex = data.findIndex((key) => key.id === apiKey.id);
  if (existingIndex !== -1) {
    return data.map((key) => (key.id === apiKey.id ? apiKey : key));
  }

  return insertAt(data, apiKey, index);
}
