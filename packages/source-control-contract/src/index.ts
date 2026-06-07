import { z } from "zod";

export const SOURCE_CONTROL_WEBHOOK_DELIVERY_STATUSES = [
  "received",
  "ignored",
  "queued",
  "processed",
  "failed",
] as const;

export const SOURCE_CONTROL_REPOSITORY_SYNC_STATUSES = [
  "enabled",
  "disabled",
] as const;

export const SOURCE_CONTROL_PR_WEBHOOK_EVENTS = [
  "pull_request",
  "pull_request_review",
  "pull_request_review_comment",
  "pull_request_review_thread",
  "issue_comment",
] as const;

export const SOURCE_CONTROL_ALL_PATHS_GLOB = "**" as const;

export const sourceControlWebhookDeliveryStatusSchema = z.enum(
  SOURCE_CONTROL_WEBHOOK_DELIVERY_STATUSES
);

export const sourceControlRepositorySyncStatusSchema = z.enum(
  SOURCE_CONTROL_REPOSITORY_SYNC_STATUSES
);

export const sourceControlPrWebhookEventSchema = z.enum(
  SOURCE_CONTROL_PR_WEBHOOK_EVENTS
);

export const watchedWebhookEventsSchema = z.array(
  sourceControlPrWebhookEventSchema
);

export type SourceControlWebhookDeliveryStatus = z.infer<
  typeof sourceControlWebhookDeliveryStatusSchema
>;

export type SourceControlRepositorySyncStatus = z.infer<
  typeof sourceControlRepositorySyncStatusSchema
>;

export type SourceControlPrWebhookEvent = z.infer<
  typeof sourceControlPrWebhookEventSchema
>;

export type WatchedWebhookEvents = z.infer<typeof watchedWebhookEventsSchema>;

const sha1Schema = z
  .string()
  .regex(/^[0-9a-f]{40}$/i, "Expected 40-character SHA-1");

const repositoryFullNameSchema = z
  .string()
  .regex(/^[^/\s]+\/[^/\s]+$/, "Expected repository full name as owner/repo");

function isSupportedWatchedPathPattern(pattern: string): boolean {
  if (pattern === SOURCE_CONTROL_ALL_PATHS_GLOB) {
    return true;
  }

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

export function normalizeWatchedWebhookEvents(
  value: WatchedWebhookEvents | null | undefined
): WatchedWebhookEvents {
  return watchedWebhookEventsSchema.parse(value ?? []);
}

export function watchesWebhookEvent(
  watchedEvents: WatchedWebhookEvents | null | undefined,
  event: string
): boolean {
  const parsedEvent = sourceControlPrWebhookEventSchema.safeParse(event);
  if (!parsedEvent.success) {
    return false;
  }
  return normalizeWatchedWebhookEvents(watchedEvents).includes(
    parsedEvent.data
  );
}

export const sourceControlRepositoryPushEventSchema = z.object({
  afterSha: sha1Schema,
  beforeSha: sha1Schema,
  changedPaths: z.array(z.string().min(1)),
  changedPathsComplete: z.boolean().optional(),
  deliveryId: z.string().min(1),
  orgSourceControlBindingId: z.number().int().positive(),
  providerInstallationId: z.string().min(1),
  providerRepositoryId: z.string().min(1),
  ref: z.string().min(1),
  repositoryFullName: repositoryFullNameSchema,
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
  if (pattern === SOURCE_CONTROL_ALL_PATHS_GLOB) {
    return path.length > 0;
  }

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
  return watchedPathGlobs.some((pattern) =>
    matchesSinglePattern(path, pattern)
  );
}

export function matchesAnyWatchedPath(
  paths: readonly string[],
  watchedPathGlobs: readonly string[]
): boolean {
  return paths.some((path) => matchesWatchedPath(path, watchedPathGlobs));
}
