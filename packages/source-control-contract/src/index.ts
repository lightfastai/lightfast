import { z } from "zod";

export const SOURCE_CONTROL_WEBHOOK_DELIVERY_STATUSES = [
  "received",
  "ignored",
  "queued",
  "processed",
  "failed",
] as const;

export const sourceControlWebhookDeliveryStatusSchema = z.enum(
  SOURCE_CONTROL_WEBHOOK_DELIVERY_STATUSES
);

export type SourceControlWebhookDeliveryStatus = z.infer<
  typeof sourceControlWebhookDeliveryStatusSchema
>;

function isSupportedWatchedPathPattern(pattern: string): boolean {
  if (!pattern.includes("*")) {
    return pattern.length > 0;
  }

  if (!pattern.endsWith("/**")) {
    return false;
  }

  const prefix = pattern.slice(0, -3);
  return prefix.length > 0 && !prefix.includes("*");
}

export const watchedPathGlobsSchema = z
  .array(
    z.string().min(1).refine(isSupportedWatchedPathPattern, {
      message: "Unsupported watched path pattern",
    })
  )
  .min(1);
export type WatchedPathGlobs = z.infer<typeof watchedPathGlobsSchema>;

export const sourceControlRepositoryPushEventSchema = z.object({
  afterSha: z.string().min(1),
  beforeSha: z.string().min(1),
  deliveryId: z.string().min(1),
  orgSourceControlBindingId: z.number().int().positive(),
  providerInstallationId: z.string().min(1),
  providerRepositoryId: z.string().min(1),
  ref: z.string().min(1),
  repositoryFullName: z.string().min(1),
  repositoryWatchId: z.number().int().positive(),
});

export type SourceControlRepositoryPushEvent = z.infer<
  typeof sourceControlRepositoryPushEventSchema
>;

export function splitRepositoryFullName(fullName: string): {
  owner: string;
  repo: string;
} {
  const [owner, repo, extra] = fullName.split("/");
  if (!(owner && repo) || extra !== undefined) {
    throw new Error(`Invalid repository full name: ${fullName}`);
  }
  return { owner, repo };
}

function matchesSinglePattern(path: string, pattern: string): boolean {
  if (pattern.endsWith("/**")) {
    const prefix = pattern.slice(0, -3);
    return path === prefix || path.startsWith(`${prefix}/`);
  }
  return path === pattern;
}

export function matchesWatchedPath(
  path: string,
  watchedPathGlobs: readonly string[]
): boolean {
  return watchedPathGlobs.some((pattern) => matchesSinglePattern(path, pattern));
}
