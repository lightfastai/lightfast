import {
  getOrgBindingByProviderInstallation,
  getWatchedSourceControlRepository,
  markSourceControlWebhookDeliveryStatus,
  recordSourceControlPrWebhookDelivery,
  recordSourceControlWebhookDeliveryReceived,
} from "@db/app";
import { db } from "@db/app/client";
import {
  githubPingWebhookPayloadSchema,
  githubPrWebhookEventSchema,
  githubPrWebhookPayloadSchema,
  githubPushWebhookPayloadSchema,
  normalizeGitHubPrWebhookPayload,
  normalizeGitHubPushWebhookPayload,
} from "@lightfast/connector-github/contract";
import {
  matchesAnyWatchedPath,
  sourceControlRepositoryPushEventSchema,
  watchesWebhookEvent,
} from "@repo/source-control-contract";
import { log } from "@vendor/observability/log/next";

import { inngest } from "../../../inngest/client";

const ZERO_SHA = "0".repeat(40);

export interface GitHubWebhookResult {
  body: Record<string, unknown>;
  status: number;
}

function webhookResult(
  status: number,
  body: Record<string, unknown>
): GitHubWebhookResult {
  return { body, status };
}

function webhookRejectionMeta(input: {
  deliveryId?: string | null;
  event?: string | null;
  reason: string;
  status: number;
}) {
  const meta: Record<string, unknown> = {
    reason: input.reason,
    status: input.status,
  };
  if (input.deliveryId) {
    meta.deliveryId = input.deliveryId;
  }
  if (input.event) {
    meta.event = input.event;
  }
  return meta;
}

function logWebhookRejection(input: {
  deliveryId?: string | null;
  event?: string | null;
  reason: string;
  status: number;
}) {
  log.warn("[github-webhook] rejected", webhookRejectionMeta(input));
}

async function handleGitHubPrWebhook(input: {
  deliveryId: string;
  event: string;
  json: unknown;
}): Promise<GitHubWebhookResult> {
  const parsedEvent = githubPrWebhookEventSchema.safeParse(input.event);
  if (!parsedEvent.success) {
    return webhookResult(202, { ok: true, ignored: true });
  }

  const parsedPayload = githubPrWebhookPayloadSchema.safeParse(input.json);
  if (!parsedPayload.success) {
    logWebhookRejection({
      deliveryId: input.deliveryId,
      event: input.event,
      reason: "invalid_pr_payload",
      status: 400,
    });
    return webhookResult(400, { ok: false });
  }
  const rawPayload = input.json as Record<string, unknown>;

  let normalized;
  try {
    normalized = normalizeGitHubPrWebhookPayload({
      event: parsedEvent.data,
      payload: parsedPayload.data,
    });
  } catch {
    logWebhookRejection({
      deliveryId: input.deliveryId,
      event: input.event,
      reason: "invalid_pr_payload_normalization",
      status: 400,
    });
    return webhookResult(400, { ok: false });
  }

  if (!normalized) {
    return webhookResult(202, { ok: true, ignored: true });
  }

  const binding = await getOrgBindingByProviderInstallation(db, {
    provider: "github",
    providerInstallationId: normalized.providerInstallationId,
  });
  if (!binding || binding.status !== "active") {
    return webhookResult(202, { ok: true, ignored: true });
  }

  const watch = await getWatchedSourceControlRepository(db, {
    orgSourceControlBindingId: binding.id,
    providerRepositoryId: normalized.providerRepositoryId,
  });
  if (!watch) {
    return webhookResult(202, { ok: true, ignored: true });
  }

  if (!watchesWebhookEvent(watch.watchedWebhookEvents, normalized.event)) {
    return webhookResult(202, { ok: true, ignored: true });
  }

  await recordSourceControlPrWebhookDelivery(db, {
    action: normalized.action,
    clerkOrgId: binding.clerkOrgId,
    deliveryId: input.deliveryId,
    event: normalized.event,
    orgSourceControlBindingId: binding.id,
    providerInstallationId: normalized.providerInstallationId,
    providerPullRequestId: normalized.providerPullRequestId,
    providerRepositoryId: normalized.providerRepositoryId,
    pullRequestNumber: normalized.pullRequestNumber,
    rawPayload,
    sourceControlRepositoryId: watch.id,
  });

  return webhookResult(202, { ok: true });
}

export async function handleVerifiedGitHubWebhook(input: {
  body: string;
  deliveryId: string;
  event: string;
}): Promise<GitHubWebhookResult> {
  const isPrWebhookEvent = githubPrWebhookEventSchema.safeParse(
    input.event
  ).success;
  if (input.event !== "ping" && input.event !== "push" && !isPrWebhookEvent) {
    return webhookResult(202, { ok: true, ignored: true });
  }

  let json: unknown;
  try {
    json = JSON.parse(input.body);
  } catch {
    logWebhookRejection({
      deliveryId: input.deliveryId,
      event: input.event,
      reason: "malformed_json",
      status: 400,
    });
    return webhookResult(400, { ok: false });
  }

  if (input.event === "ping") {
    const parsedPing = githubPingWebhookPayloadSchema.safeParse(json);
    if (!parsedPing.success) {
      logWebhookRejection({
        deliveryId: input.deliveryId,
        event: input.event,
        reason: "invalid_ping_payload",
        status: 400,
      });
      return webhookResult(400, { ok: false });
    }
    return webhookResult(202, { ok: true });
  }

  if (isPrWebhookEvent) {
    return await handleGitHubPrWebhook({
      deliveryId: input.deliveryId,
      event: input.event,
      json,
    });
  }

  const parsedPush = githubPushWebhookPayloadSchema.safeParse(json);
  if (!parsedPush.success) {
    logWebhookRejection({
      deliveryId: input.deliveryId,
      event: input.event,
      reason: "invalid_push_payload",
      status: 400,
    });
    return webhookResult(400, { ok: false });
  }

  const push = normalizeGitHubPushWebhookPayload(parsedPush.data);
  const deliveryRecord = await recordSourceControlWebhookDeliveryReceived(db, {
    deliveryId: input.deliveryId,
    event: input.event,
    providerInstallationId: push.providerInstallationId,
    providerRepositoryId: push.providerRepositoryId,
  });
  const delivery = deliveryRecord.delivery;

  if (delivery.status !== "received") {
    return webhookResult(202, { ok: true, duplicate: true });
  }

  if (push.afterSha === ZERO_SHA) {
    await markSourceControlWebhookDeliveryStatus(db, {
      deliveryId: input.deliveryId,
      status: "ignored",
    });
    return webhookResult(202, { ok: true, ignored: true });
  }

  const binding = await getOrgBindingByProviderInstallation(db, {
    provider: "github",
    providerInstallationId: push.providerInstallationId,
  });
  if (!binding || binding.status !== "active") {
    await markSourceControlWebhookDeliveryStatus(db, {
      deliveryId: input.deliveryId,
      status: "ignored",
    });
    return webhookResult(202, { ok: true, ignored: true });
  }

  const watch = await getWatchedSourceControlRepository(db, {
    orgSourceControlBindingId: binding.id,
    providerRepositoryId: push.providerRepositoryId,
  });
  if (!watch) {
    await markSourceControlWebhookDeliveryStatus(db, {
      deliveryId: input.deliveryId,
      status: "ignored",
    });
    return webhookResult(202, { ok: true, ignored: true });
  }

  if (watch.syncStatus !== "enabled") {
    await markSourceControlWebhookDeliveryStatus(db, {
      deliveryId: input.deliveryId,
      status: "ignored",
    });
    return webhookResult(202, { ok: true, ignored: true });
  }

  if (watch.watchedPathGlobs === null) {
    await markSourceControlWebhookDeliveryStatus(db, {
      deliveryId: input.deliveryId,
      status: "ignored",
    });
    return webhookResult(202, { ok: true, ignored: true });
  }

  const changedPathsMatch = matchesAnyWatchedPath(
    push.changedPaths,
    watch.watchedPathGlobs
  );
  const shouldConservativelyQueue =
    push.ref === "refs/heads/main" && !push.changedPathsComplete;

  if (!(changedPathsMatch || shouldConservativelyQueue)) {
    await markSourceControlWebhookDeliveryStatus(db, {
      deliveryId: input.deliveryId,
      status: "ignored",
    });
    return webhookResult(202, { ok: true, ignored: true });
  }

  const event = sourceControlRepositoryPushEventSchema.parse({
    ...push,
    deliveryId: input.deliveryId,
    orgSourceControlBindingId: binding.id,
    repositoryWatchId: watch.id,
  });
  await inngest.send({
    name: "app/github.repository.push.received",
    data: event,
  });
  await markSourceControlWebhookDeliveryStatus(db, {
    deliveryId: input.deliveryId,
    status: "queued",
  });

  return webhookResult(202, { ok: true });
}
