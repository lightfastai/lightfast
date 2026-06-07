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
  githubWebhookHeadersSchema,
  normalizeGitHubPrWebhookPayload,
  normalizeGitHubPushWebhookPayload,
} from "@repo/github-app-contract";
import { verifyGitHubWebhookSignature } from "@repo/github-app-node";
import {
  matchesAnyWatchedPath,
  sourceControlRepositoryPushEventSchema,
  watchesWebhookEvent,
} from "@repo/source-control-contract";
import { log } from "@vendor/observability/log/next";

import { env } from "../../../env";
import { inngest } from "../../../inngest/client";

const ZERO_SHA = "0".repeat(40);

function response(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status });
}

function readHeaders(request: Request) {
  return githubWebhookHeadersSchema.safeParse({
    deliveryId: request.headers.get("x-github-delivery"),
    event: request.headers.get("x-github-event"),
    signature256: request.headers.get("x-hub-signature-256"),
  });
}

function readWebhookLogHeaders(request: Request) {
  return {
    deliveryId: request.headers.get("x-github-delivery"),
    event: request.headers.get("x-github-event"),
  };
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
}): Promise<Response> {
  const parsedEvent = githubPrWebhookEventSchema.safeParse(input.event);
  if (!parsedEvent.success) {
    return response(202, { ok: true, ignored: true });
  }

  const parsedPayload = githubPrWebhookPayloadSchema.safeParse(input.json);
  if (!parsedPayload.success) {
    logWebhookRejection({
      deliveryId: input.deliveryId,
      event: input.event,
      reason: "invalid_pr_payload",
      status: 400,
    });
    return response(400, { ok: false });
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
    return response(400, { ok: false });
  }

  if (!normalized) {
    return response(202, { ok: true, ignored: true });
  }

  const binding = await getOrgBindingByProviderInstallation(db, {
    provider: "github",
    providerInstallationId: normalized.providerInstallationId,
  });
  if (!binding || binding.status !== "active") {
    return response(202, { ok: true, ignored: true });
  }

  const watch = await getWatchedSourceControlRepository(db, {
    orgSourceControlBindingId: binding.id,
    providerRepositoryId: normalized.providerRepositoryId,
  });
  if (!watch) {
    return response(202, { ok: true, ignored: true });
  }

  if (!watchesWebhookEvent(watch.watchedWebhookEvents, normalized.event)) {
    return response(202, { ok: true, ignored: true });
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

  return response(202, { ok: true });
}

export async function handleGitHubWebhook(input: {
  request: Request;
}): Promise<Response> {
  const secret = env.GITHUB_APP_WEBHOOK_SECRET;
  if (!secret) {
    log.error(
      "[github-webhook] rejected",
      webhookRejectionMeta({
        ...readWebhookLogHeaders(input.request),
        reason: "missing_webhook_secret",
        status: 500,
      })
    );
    return response(500, { ok: false });
  }

  const body = await input.request.text();
  const signature256 = input.request.headers.get("x-hub-signature-256");
  if (!signature256) {
    logWebhookRejection({
      ...readWebhookLogHeaders(input.request),
      reason: "missing_signature",
      status: 401,
    });
    return response(401, { ok: false });
  }

  const parsedHeaders = readHeaders(input.request);
  if (!parsedHeaders.success) {
    logWebhookRejection({
      ...readWebhookLogHeaders(input.request),
      reason: "invalid_headers",
      status: 400,
    });
    return response(400, { ok: false });
  }

  const headers = parsedHeaders.data;
  const signatureOk = verifyGitHubWebhookSignature({
    body,
    secret,
    signature256: headers.signature256,
  });
  if (!signatureOk) {
    logWebhookRejection({
      deliveryId: headers.deliveryId,
      event: headers.event,
      reason: "invalid_signature",
      status: 401,
    });
    return response(401, { ok: false });
  }

  const isPrWebhookEvent = githubPrWebhookEventSchema.safeParse(
    headers.event
  ).success;
  if (
    headers.event !== "ping" &&
    headers.event !== "push" &&
    !isPrWebhookEvent
  ) {
    return response(202, { ok: true, ignored: true });
  }

  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    logWebhookRejection({
      deliveryId: headers.deliveryId,
      event: headers.event,
      reason: "malformed_json",
      status: 400,
    });
    return response(400, { ok: false });
  }

  if (headers.event === "ping") {
    const parsedPing = githubPingWebhookPayloadSchema.safeParse(json);
    if (!parsedPing.success) {
      logWebhookRejection({
        deliveryId: headers.deliveryId,
        event: headers.event,
        reason: "invalid_ping_payload",
        status: 400,
      });
      return response(400, { ok: false });
    }
    return response(202, { ok: true });
  }

  if (isPrWebhookEvent) {
    return await handleGitHubPrWebhook({
      deliveryId: headers.deliveryId,
      event: headers.event,
      json,
    });
  }

  const parsedPush = githubPushWebhookPayloadSchema.safeParse(json);
  if (!parsedPush.success) {
    logWebhookRejection({
      deliveryId: headers.deliveryId,
      event: headers.event,
      reason: "invalid_push_payload",
      status: 400,
    });
    return response(400, { ok: false });
  }

  const push = normalizeGitHubPushWebhookPayload(parsedPush.data);
  const deliveryRecord = await recordSourceControlWebhookDeliveryReceived(db, {
    deliveryId: headers.deliveryId,
    event: headers.event,
    providerInstallationId: push.providerInstallationId,
    providerRepositoryId: push.providerRepositoryId,
  });
  const delivery = deliveryRecord.delivery;

  if (delivery.status !== "received") {
    return response(202, { ok: true, duplicate: true });
  }

  if (push.afterSha === ZERO_SHA) {
    await markSourceControlWebhookDeliveryStatus(db, {
      deliveryId: headers.deliveryId,
      status: "ignored",
    });
    return response(202, { ok: true, ignored: true });
  }

  const binding = await getOrgBindingByProviderInstallation(db, {
    provider: "github",
    providerInstallationId: push.providerInstallationId,
  });
  if (!binding || binding.status !== "active") {
    await markSourceControlWebhookDeliveryStatus(db, {
      deliveryId: headers.deliveryId,
      status: "ignored",
    });
    return response(202, { ok: true, ignored: true });
  }

  const watch = await getWatchedSourceControlRepository(db, {
    orgSourceControlBindingId: binding.id,
    providerRepositoryId: push.providerRepositoryId,
  });
  if (!watch) {
    await markSourceControlWebhookDeliveryStatus(db, {
      deliveryId: headers.deliveryId,
      status: "ignored",
    });
    return response(202, { ok: true, ignored: true });
  }

  if (watch.syncStatus !== "enabled") {
    await markSourceControlWebhookDeliveryStatus(db, {
      deliveryId: headers.deliveryId,
      status: "ignored",
    });
    return response(202, { ok: true, ignored: true });
  }

  if (watch.watchedPathGlobs === null) {
    await markSourceControlWebhookDeliveryStatus(db, {
      deliveryId: headers.deliveryId,
      status: "ignored",
    });
    return response(202, { ok: true, ignored: true });
  }

  const changedPathsMatch = matchesAnyWatchedPath(
    push.changedPaths,
    watch.watchedPathGlobs
  );
  const shouldConservativelyQueue =
    push.ref === "refs/heads/main" && !push.changedPathsComplete;

  if (!(changedPathsMatch || shouldConservativelyQueue)) {
    await markSourceControlWebhookDeliveryStatus(db, {
      deliveryId: headers.deliveryId,
      status: "ignored",
    });
    return response(202, { ok: true, ignored: true });
  }

  const event = sourceControlRepositoryPushEventSchema.parse({
    ...push,
    deliveryId: headers.deliveryId,
    orgSourceControlBindingId: binding.id,
    repositoryWatchId: watch.id,
  });
  await inngest.send({
    name: "app/github.repository.push.received",
    data: event,
  });
  await markSourceControlWebhookDeliveryStatus(db, {
    deliveryId: headers.deliveryId,
    status: "queued",
  });

  return response(202, { ok: true });
}
