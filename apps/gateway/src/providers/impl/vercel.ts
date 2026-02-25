import { computeHmacSha1, timingSafeEqual } from "../../lib/crypto";
import { vercelWebhookPayloadSchema } from "../schemas";
import type { VercelWebhookPayload } from "../schemas";
import type {
  WebhookProvider,
  WebhookPayload,
} from "../types";

// Vercel webhooks use HMAC-SHA1 (not SHA-256). This is imposed by Vercel's
// webhook infrastructure — see https://vercel.com/docs/webhooks/webhooks-api
const SIGNATURE_HEADER = "x-vercel-signature";
const DELIVERY_HEADER = "x-vercel-id";

export class VercelProvider implements WebhookProvider {
  readonly name = "vercel" as const;

  async verifyWebhook(
    payload: string,
    headers: Headers,
    secret: string,
  ): Promise<boolean> {
    const signature = headers.get(SIGNATURE_HEADER);
    if (!signature) return false;

    const expectedSig = await computeHmacSha1(payload, secret);
    return timingSafeEqual(signature, expectedSig);
  }

  parsePayload(raw: unknown): VercelWebhookPayload {
    return vercelWebhookPayloadSchema.parse(raw);
  }

  extractDeliveryId(headers: Headers, payload: WebhookPayload): string {
    // Prefer payload id — it is stable across retries of the same event.
    // x-vercel-id is a per-request tracing header and changes on each retry.
    const p = payload as VercelWebhookPayload;
    if (p.id) return p.id;

    const headerId = headers.get(DELIVERY_HEADER);
    if (headerId) return headerId;

    return crypto.randomUUID();
  }

  extractEventType(_headers: Headers, payload: WebhookPayload): string {
    const p = payload as VercelWebhookPayload;
    return p.type ?? "unknown";
  }

  extractResourceId(payload: WebhookPayload): string | null {
    const p = payload as VercelWebhookPayload;
    const projectId = p.payload?.project?.id;
    if (projectId != null) return String(projectId);

    const teamId = p.payload?.team?.id;
    if (teamId != null) return String(teamId);

    return null;
  }
}
