import { join } from "node:path";

function sanitizeInstanceId(instanceId: string): string | null {
  const sanitized = instanceId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 80);

  return sanitized === "" ? null : sanitized;
}

export function resolveUserDataPath(
  appDataPath: string,
  isPackaged: boolean,
  instanceId?: string
): string {
  if (isPackaged) {
    return join(appDataPath, "lightfast");
  }

  const root = join(appDataPath, "lightfast-local");
  const sanitizedInstanceId =
    instanceId === undefined ? null : sanitizeInstanceId(instanceId);

  if (sanitizedInstanceId === null) {
    return root;
  }

  return join(root, "instances", sanitizedInstanceId);
}
