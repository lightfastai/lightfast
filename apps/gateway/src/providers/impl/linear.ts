import { computeHmacSha256, timingSafeEqual } from "../../lib/crypto";
import { linearWebhookPayloadSchema } from "../schemas";
import type { LinearWebhookPayload } from "../schemas";
import type {
  WebhookProvider,
  WebhookPayload,
} from "../types";

const SIGNATURE_HEADER = "linear-signature";
const DELIVERY_HEADER = "linear-delivery";

export class LinearProvider implements WebhookProvider {
  readonly name = "linear" as const;

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

  parsePayload(raw: unknown): LinearWebhookPayload {
    return linearWebhookPayloadSchema.parse(raw);
  }

  extractDeliveryId(headers: Headers, _payload: WebhookPayload): string {
    return headers.get(DELIVERY_HEADER) ?? crypto.randomUUID();
  }

  extractEventType(_headers: Headers, payload: WebhookPayload): string {
    const p = payload as LinearWebhookPayload;
    if (p.type && p.action) return `${p.type}:${p.action}`;
    return p.type ?? "unknown";
  }

  extractResourceId(payload: WebhookPayload): string | null {
    const p = payload as LinearWebhookPayload;
    return p.organizationId ?? null;
  }
}
