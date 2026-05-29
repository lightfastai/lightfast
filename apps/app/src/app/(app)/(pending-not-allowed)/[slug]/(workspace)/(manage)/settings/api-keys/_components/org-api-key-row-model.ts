import type { OrgApiKey } from "./org-api-key-cache";

export function getOrgApiKeyRowModel(
  key: OrgApiKey,
  {
    now = Date.now(),
    pendingDeleteKeyId,
    pendingRevokeKeyId,
  }: {
    now?: number;
    pendingDeleteKeyId?: string;
    pendingRevokeKeyId?: string;
  } = {}
) {
  const isExpired = typeof key.expires === "number" && key.expires <= now;
  const isPending =
    pendingRevokeKeyId === key.keyId || pendingDeleteKeyId === key.keyId;
  const isActive = key.enabled && !isExpired;
  const keyName = key.name ?? key.start;

  return {
    isActive,
    isExpired,
    isPending,
    keyName,
  };
}
