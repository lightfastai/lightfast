import { computeHmacSha256, timingSafeEqual } from "../../lib/crypto.js";
import { linearWebhookPayloadSchema } from "../schemas.js";
import type { LinearWebhookPayload } from "../schemas.js";
import type {
  WebhookProvider,
  WebhookPayload,
} from "../types.js";
import type { RelayEnv } from "../../env.js";

const SIGNATURE_HEADER = "linear-signature";
const DELIVERY_HEADER = "linear-delivery";

export class LinearProvider implements WebhookProvider {
  readonly name = "linear" as const;

  getWebhookSecret(env: RelayEnv): string {
    return env.LINEAR_WEBHOOK_SIGNING_SECRET;
  }

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
    return headers.get(DELIVERY_HEADER) ?? stableFingerprint(_payload);
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

/** Recursively sort object keys for deterministic serialization. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }
  const sorted = Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      (k) =>
        JSON.stringify(k) +
        ":" +
        stableStringify((value as Record<string, unknown>)[k]),
    );
  return "{" + sorted.join(",") + "}";
}

/**
 * Deterministic fingerprint from payload for idempotent delivery IDs.
 * Uses multi-seed FNV-1a to produce a 128-bit hex string synchronously.
 */
function stableFingerprint(payload: WebhookPayload): string {
  const str = stableStringify(payload);
  let h1 = 0x811c9dc5;
  let h2 = 0x050c5d1f;
  let h3 = 0x1a47e90b;
  let h4 = 0x7fee3cb1;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x01000193);
    h3 = Math.imul(h3 ^ c, 0x01000193);
    h4 = Math.imul(h4 ^ c, 0x01000193);
  }
  return [h1, h2, h3, h4]
    .map((h) => (h >>> 0).toString(16).padStart(8, "0"))
    .join("");
}
