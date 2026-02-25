/**
 * @vendor/qstash
 *
 * Vendor abstraction for Upstash QStash SDK
 *
 * Provides a standalone, independent wrapper around @upstash/qstash
 * for durable, at-least-once message delivery.
 *
 * @example
 * ```typescript
 * // Publish a message
 * import { getQStashClient } from "@vendor/qstash";
 *
 * const client = getQStashClient();
 * await client.publishJSON({
 *   url: "https://example.com/api/webhook-ingress",
 *   body: { event: "user.created", userId: "123" },
 *   retries: 5,
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Verify a QStash request
 * import { Receiver } from "@vendor/qstash";
 *
 * const receiver = new Receiver();
 * const isValid = await receiver.verify({
 *   signature: request.headers.get("upstash-signature") ?? "",
 *   body: await request.text(),
 * });
 * ```
 */

export { QStashClient, getQStashClient } from "./client";
export type {
  PublishJsonOptions,
  PublishToTopicOptions,
  QStashPublishResponse,
} from "./client";
export { Receiver } from "./receiver";
export type { VerifyOptions } from "./receiver";
