import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultDetectWorktreePrefix,
  hashProjectRoot,
  sanitizeWorktreePrefix,
} from "@lightfastai/dev-core";

export const DEV_PROJECT_NAME = "lightfast";
export const DEV_PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

export function resolveLocalDevProjectIdentity({
  root = DEV_PROJECT_ROOT,
  detectWorktreePrefix = defaultDetectWorktreePrefix,
} = {}) {
  const resolvedRoot = path.resolve(root);
  const detectedPrefix = detectWorktreePrefix(resolvedRoot);
  const worktreePrefix = detectedPrefix
    ? sanitizeWorktreePrefix(detectedPrefix)
    : undefined;

  return {
    root: resolvedRoot,
    name: DEV_PROJECT_NAME,
    worktreePrefix,
    rootHash: hashProjectRoot(resolvedRoot),
  };
}
