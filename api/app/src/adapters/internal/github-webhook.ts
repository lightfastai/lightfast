import { githubWebhookHeadersSchema } from "@lightfast/connector-github/contract";
import { verifyGitHubWebhookSignature } from "@lightfast/connector-github/node";
import { log } from "@vendor/observability/log/next";

import { env } from "../../env";
import { handleVerifiedGitHubWebhook } from "../../services/github";

function response(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status });
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

export async function handleGitHubWebhookRequest(
  request: Request
): Promise<Response> {
  const secret = env.GITHUB_APP_WEBHOOK_SECRET;
  if (!secret) {
    log.error(
      "[github-webhook] rejected",
      webhookRejectionMeta({
        ...readWebhookLogHeaders(request),
        reason: "missing_webhook_secret",
        status: 500,
      })
    );
    return response(500, { ok: false });
  }

  const body = await request.text();
  const signature256 = request.headers.get("x-hub-signature-256");
  if (!signature256) {
    logWebhookRejection({
      ...readWebhookLogHeaders(request),
      reason: "missing_signature",
      status: 401,
    });
    return response(401, { ok: false });
  }

  const parsedHeaders = githubWebhookHeadersSchema.safeParse({
    deliveryId: request.headers.get("x-github-delivery"),
    event: request.headers.get("x-github-event"),
    signature256,
  });
  if (!parsedHeaders.success) {
    logWebhookRejection({
      ...readWebhookLogHeaders(request),
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

  return handleVerifiedGitHubWebhook({
    body,
    deliveryId: headers.deliveryId,
    event: headers.event,
  });
}
