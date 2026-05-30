import {
  getOrgBindingByProviderInstallation,
  getWatchedSourceControlRepository,
  markSourceControlWebhookDeliveryStatus,
  recordSourceControlWebhookDeliveryReceived,
  updateWatchedSourceControlRepositoryLastSeenSha,
} from "@db/app";
import { db } from "@db/app/client";
import {
  githubPingWebhookPayloadSchema,
  githubPushWebhookPayloadSchema,
  githubWebhookHeadersSchema,
  normalizeGitHubPushWebhookPayload,
} from "@repo/github-app-contract";
import { verifyGitHubWebhookSignature } from "@repo/github-app-node";
import { sourceControlRepositoryPushEventSchema } from "@repo/source-control-contract";

import { env } from "../../../env";
import { inngest } from "../../../inngest/client";

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

export async function handleGitHubWebhook(input: {
  request: Request;
}): Promise<Response> {
  const secret = env.GITHUB_APP_WEBHOOK_SECRET;
  if (!secret) {
    return response(500, { ok: false });
  }

  const body = await input.request.text();
  const parsedHeaders = readHeaders(input.request);
  if (!parsedHeaders.success) {
    return response(400, { ok: false });
  }

  const headers = parsedHeaders.data;
  const signatureOk = verifyGitHubWebhookSignature({
    body,
    secret,
    signature256: headers.signature256,
  });
  if (!signatureOk) {
    return response(401, { ok: false });
  }

  if (headers.event !== "ping" && headers.event !== "push") {
    return response(202, { ok: true, ignored: true });
  }

  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return response(400, { ok: false });
  }

  if (headers.event === "ping") {
    const parsedPing = githubPingWebhookPayloadSchema.safeParse(json);
    return parsedPing.success
      ? response(202, { ok: true })
      : response(400, { ok: false });
  }

  const parsedPush = githubPushWebhookPayloadSchema.safeParse(json);
  if (!parsedPush.success) {
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

  if (
    !deliveryRecord.created ||
    delivery.status === "queued" ||
    delivery.status === "processed"
  ) {
    return response(202, { ok: true, duplicate: true });
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

  await updateWatchedSourceControlRepositoryLastSeenSha(db, {
    id: watch.id,
    lastSeenSha: push.afterSha,
  });
  await markSourceControlWebhookDeliveryStatus(db, {
    deliveryId: headers.deliveryId,
    status: "queued",
  });

  const event = sourceControlRepositoryPushEventSchema.parse({
    ...push,
    deliveryId: headers.deliveryId,
    orgSourceControlBindingId: binding.id,
    repositoryWatchId: watch.id,
  });
  await inngest.send({
    name: "app/source-control.repository.push.received",
    data: event,
  });

  return response(202, { ok: true });
}
