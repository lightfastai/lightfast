import { db } from "@db/console";
import { workspaceWebhookPayloads } from "@db/console/schema";
import type { SourceType } from "@repo/console-validation";

export interface StoreWebhookPayloadParams {
  workspaceId: string;
  deliveryId: string;
  source: SourceType;
  eventType: string;
  payload: string; // Raw JSON string from request.text()
  headers: Record<string, string>;
  receivedAt: Date;
}

/**
 * Store raw webhook payload for permanent retention.
 * Called after signature verification and workspace resolution.
 *
 * @param params - Webhook payload data to store
 * @returns The internal BIGINT ID of the stored payload record
 */
export async function storeWebhookPayload(
  params: StoreWebhookPayloadParams
): Promise<number> {
  const [record] = await db
    .insert(workspaceWebhookPayloads)
    .values({
      workspaceId: params.workspaceId,
      deliveryId: params.deliveryId,
      source: params.source,
      eventType: params.eventType,
      payload: JSON.parse(params.payload),
      headers: params.headers,
      receivedAt: params.receivedAt.toISOString(),
    })
    .returning({ id: workspaceWebhookPayloads.id });

  if (!record) {
    throw new Error("Failed to insert webhook payload record");
  }

  return record.id;
}

/**
 * Extract relevant headers from request for storage.
 * Captures headers useful for debugging and context.
 *
 * @param headers - Request Headers object
 * @returns Record of relevant header key-value pairs
 */
export function extractWebhookHeaders(headers: Headers): Record<string, string> {
  const relevantKeys = [
    // Common
    "user-agent",
    "content-type",
    "x-forwarded-for",
    // GitHub specific
    "x-github-delivery",
    "x-github-event",
    "x-github-hook-id",
    "x-github-hook-installation-target-id",
    "x-github-hook-installation-target-type",
    "x-hub-signature-256",
    // Vercel specific
    "x-vercel-signature",
    "x-vercel-id",
  ];

  const result: Record<string, string> = {};
  for (const key of relevantKeys) {
    const value = headers.get(key);
    if (value) {
      result[key] = value;
    }
  }
  return result;
}
