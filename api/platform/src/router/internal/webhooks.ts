/**
 * Internal webhooks sub-router.
 *
 * Handles webhook ingestion: HMAC verification, DB persistence, Inngest dispatch.
 * Moved from apps/platform/src/app/api/ingest/[provider]/route.ts.
 */

import { db } from "@db/app/client";
import { gatewayWebhookDeliveries } from "@db/app/schema";
import type { WebhookDef } from "@repo/app-providers";
import {
  deriveVerifySignature,
  getProvider,
  hasInboundWebhooks,
  isWebhookProvider,
} from "@repo/app-providers";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { log } from "@vendor/observability/log/next";
import { z } from "zod";
import { inngest } from "../../inngest/client";
import { getProviderConfigs } from "../../lib/provider-configs";
import { internalProcedure } from "../../trpc";

// ── Helpers (moved from route handler) ──────────────────────────────────────

function getWebhookDef(
  providerDef: NonNullable<ReturnType<typeof getProvider>>
): WebhookDef<unknown> | null {
  if (isWebhookProvider(providerDef)) {
    return providerDef.webhook as WebhookDef<unknown>;
  }
  if (providerDef.kind === "managed") {
    return providerDef.inbound.webhook as WebhookDef<unknown>;
  }
  if (
    providerDef.kind === "api" &&
    "inbound" in providerDef &&
    providerDef.inbound
  ) {
    return providerDef.inbound.webhook as WebhookDef<unknown>;
  }
  return null;
}

// ── Router ──────────────────────────────────────────────────────────────────

export const webhooksInternalRouter = {
  /**
   * Ingest a webhook delivery: verify HMAC, persist to DB, dispatch to Inngest.
   *
   * The route handler extracts rawBody and headers from the HTTP request
   * and passes them here. This procedure handles everything else.
   *
   * Returns the response shape for the route handler to forward as JSON.
   */
  ingest: internalProcedure
    .input(
      z.object({
        provider: z.string(),
        rawBody: z.string(),
        headers: z.record(z.string(), z.string()),
        receivedAt: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const { provider: providerSlug, rawBody, headers, receivedAt } = input;

      // Provider guard
      const providerDef = getProvider(providerSlug);
      if (!providerDef) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `unknown_provider: ${providerSlug}`,
        });
      }

      if (!hasInboundWebhooks(providerDef)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `not_webhook_provider: ${providerSlug}`,
        });
      }

      const webhookDef = getWebhookDef(providerDef);
      if (!webhookDef) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `no_webhook_def: ${providerSlug}`,
        });
      }

      // Webhook header validation
      const headersObj: Record<string, string | undefined> = {};
      for (const key of Object.keys(
        (webhookDef.headersSchema as { shape: Record<string, unknown> }).shape
      )) {
        headersObj[key] = (headers as Record<string, string>)[key] ?? undefined;
      }
      const headersParsed = webhookDef.headersSchema.safeParse(headersObj);
      if (!headersParsed.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "missing_headers",
        });
      }

      // Signature verification
      const configs = getProviderConfigs();
      const providerConfig = configs[providerSlug];
      if (!providerConfig) {
        log.error("[webhooks.ingest] provider config not found", {
          provider: providerSlug,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `provider_not_configured: ${providerSlug}`,
        });
      }

      const secret = (webhookDef.extractSecret as (config: unknown) => string)(
        providerConfig
      );
      const verify =
        webhookDef.verifySignature ??
        deriveVerifySignature(webhookDef.signatureScheme);

      // Build a Headers object for the verify function (it expects Headers, not Record)
      const reqHeaders = new Headers(Object.entries(headers));
      const isValid = await verify(rawBody, reqHeaders, secret);
      if (!isValid) {
        log.warn("[webhooks.ingest] signature verification failed", {
          provider: providerSlug,
        });
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "signature_invalid",
        });
      }

      // Payload parse + metadata extraction
      let jsonPayload: unknown;
      try {
        jsonPayload = JSON.parse(rawBody);
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "invalid_json",
        });
      }

      let parsedPayload: unknown;
      try {
        parsedPayload = webhookDef.parsePayload(jsonPayload);
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `payload_validation_failed: ${providerSlug}`,
        });
      }

      const deliveryId = webhookDef.extractDeliveryId(
        reqHeaders,
        parsedPayload
      );
      const eventType = webhookDef.extractEventType(reqHeaders, parsedPayload);
      const resourceId = webhookDef.extractResourceId(parsedPayload);

      // Persist to DB
      await db
        .insert(gatewayWebhookDeliveries)
        .values({
          provider: providerSlug,
          deliveryId,
          eventType,
          installationId: null,
          status: "received",
          payload: JSON.stringify(parsedPayload),
          receivedAt: new Date(receivedAt).toISOString(),
        })
        .onConflictDoNothing();

      // Dispatch Inngest event
      const correlationId = crypto.randomUUID();

      await inngest.send({
        id: `wh-${providerSlug}-${deliveryId}`,
        name: "platform/webhook.received",
        data: {
          provider: providerSlug,
          deliveryId,
          eventType,
          resourceId,
          payload: parsedPayload,
          receivedAt,
          correlationId,
        },
      });

      log.info("[webhooks.ingest] webhook received", {
        provider: providerSlug,
        deliveryId,
        eventType,
        resourceId,
        correlationId,
      });

      return { status: "accepted" as const, deliveryId };
    }),
} satisfies TRPCRouterRecord;
