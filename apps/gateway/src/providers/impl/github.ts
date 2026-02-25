import { computeHmacSha256, timingSafeEqual } from "../../lib/crypto";
import {
  githubWebhookPayloadSchema,
} from "../schemas";
import type { GitHubWebhookPayload } from "../schemas";
import type {
  WebhookProvider,
  WebhookPayload,
} from "../types";

const SIGNATURE_HEADER = "x-hub-signature-256";
const DELIVERY_HEADER = "x-github-delivery";
const EVENT_HEADER = "x-github-event";
const SIGNATURE_PREFIX = "sha256=";

export class GitHubProvider implements WebhookProvider {
  readonly name = "github" as const;

  async verifyWebhook(
    payload: string,
    headers: Headers,
    secret: string,
  ): Promise<boolean> {
    const signature = headers.get(SIGNATURE_HEADER);
    if (!signature) return false;

    const receivedSig = signature.startsWith(SIGNATURE_PREFIX)
      ? signature.slice(SIGNATURE_PREFIX.length)
      : signature;

    const expectedSig = await computeHmacSha256(payload, secret);
    return timingSafeEqual(receivedSig, expectedSig);
  }

  parsePayload(raw: unknown): GitHubWebhookPayload {
    return githubWebhookPayloadSchema.parse(raw);
  }

  extractDeliveryId(headers: Headers, _payload: WebhookPayload): string {
    return headers.get(DELIVERY_HEADER) ?? crypto.randomUUID();
  }

  extractEventType(headers: Headers, _payload: WebhookPayload): string {
    return headers.get(EVENT_HEADER) ?? "unknown";
  }

  extractResourceId(payload: WebhookPayload): string | null {
    const p = payload as GitHubWebhookPayload;
    const repoId = p.repository?.id;
    if (repoId != null) return String(repoId);

    const installId = p.installation?.id;
    if (installId != null) return String(installId);

    return null;
  }
}
