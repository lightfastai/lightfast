import { computeHmacSha256, timingSafeEqual } from "../../lib/crypto";
import { sentryWebhookPayloadSchema } from "../schemas";
import type { SentryWebhookPayload } from "../schemas";
import type {
  WebhookProvider,
  WebhookPayload,
} from "../types";

const SIGNATURE_HEADER = "sentry-hook-signature";
const RESOURCE_HEADER = "sentry-hook-resource";
const TIMESTAMP_HEADER = "sentry-hook-timestamp";

export class SentryProvider implements WebhookProvider {
  readonly name = "sentry" as const;

  async verifyWebhook(
    payload: string,
    headers: Headers,
    secret: string,
  ): Promise<boolean> {
    const signature = headers.get(SIGNATURE_HEADER);
    if (!signature) return false;

    const expectedSig = await computeHmacSha256(payload, secret);
    return timingSafeEqual(signature, expectedSig);
  }

  parsePayload(raw: unknown): SentryWebhookPayload {
    return sentryWebhookPayloadSchema.parse(raw);
  }

  extractDeliveryId(headers: Headers, _payload: WebhookPayload): string {
    const resource = headers.get(RESOURCE_HEADER);
    const timestamp = headers.get(TIMESTAMP_HEADER);
    if (resource && timestamp) return `${resource}:${timestamp}`;
    return crypto.randomUUID();
  }

  extractEventType(headers: Headers, _payload: WebhookPayload): string {
    return headers.get(RESOURCE_HEADER) ?? "unknown";
  }

  extractResourceId(payload: WebhookPayload): string | null {
    const p = payload as SentryWebhookPayload;
    return p.installation?.uuid ?? null;
  }
}
