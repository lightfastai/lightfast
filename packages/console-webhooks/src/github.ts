/**
 * GitHub webhook verification utilities
 *
 * Provides functions for verifying GitHub webhook signatures using HMAC SHA-256.
 *
 * GitHub webhooks use the X-Hub-Signature-256 header with format: "sha256=<signature>"
 *
 * @see https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
 */

import {
  computeHmacSignature,
  extractTimestamp,
  safeCompareSignatures,
  safeParseJson,
  validateWebhookTimestamp,
} from "./common.js";
import type {
  GitHubWebhookEvent,
  GitHubWebhookVerificationResult,
} from "./types.js";
import { WebhookError, WebhookErrorMessages } from "./types.js";

/**
 * GitHub webhook signature header name
 */
export const GITHUB_SIGNATURE_HEADER = "x-hub-signature-256";

/**
 * GitHub webhook delivery ID header (for logging/debugging)
 */
export const GITHUB_DELIVERY_ID_HEADER = "x-github-delivery";

/**
 * GitHub webhook event type header
 */
export const GITHUB_EVENT_HEADER = "x-github-event";

/**
 * GitHub webhook signature prefix
 */
export const GITHUB_SIGNATURE_PREFIX = "sha256=";

/**
 * Verify a GitHub webhook signature
 *
 * This function:
 * 1. Validates the payload is not empty
 * 2. Extracts the signature from the header
 * 3. Computes the expected HMAC SHA-256 signature
 * 4. Compares signatures using timing-attack resistant comparison
 * 5. Parses and returns the event data if valid
 *
 * @param payload - Raw webhook payload (as string, not parsed)
 * @param signature - The X-Hub-Signature-256 header value
 * @param secret - Your GitHub webhook secret
 * @returns Verification result with event data if successful
 *
 * @example
 * ```ts
 * // In your webhook route handler
 * const rawPayload = await request.text();
 * const signature = request.headers.get("x-hub-signature-256");
 * const secret = env.GITHUB_WEBHOOK_SECRET;
 *
 * const result = await verifyGitHubWebhook(rawPayload, signature, secret);
 *
 * if (result.verified) {
 *   console.log("Repository:", result.event?.repository?.full_name);
 *   // Process the webhook...
 * } else {
 *   console.error("Verification failed:", result.error);
 *   return new Response("Unauthorized", { status: 401 });
 * }
 * ```
 */
export async function verifyGitHubWebhook(
  payload: string,
  signature: string | null,
  secret: string,
): Promise<GitHubWebhookVerificationResult> {
  // Validate inputs
  if (!payload || payload.trim() === "") {
    return {
      verified: false,
      error: WebhookErrorMessages[WebhookError.MISSING_PAYLOAD],
    };
  }

  if (!signature) {
    return {
      verified: false,
      error: WebhookErrorMessages[WebhookError.MISSING_SIGNATURE],
    };
  }

  if (!secret) {
    return {
      verified: false,
      error: "Webhook secret is not configured",
    };
  }

  try {
    // Extract the signature (GitHub format: "sha256=<hex>")
    const receivedSignature = signature.startsWith(GITHUB_SIGNATURE_PREFIX)
      ? signature.slice(GITHUB_SIGNATURE_PREFIX.length)
      : signature;

    // Compute expected signature
    const expectedSignature = await computeHmacSignature(payload, secret);

    // Compare signatures using timing-safe comparison
    const isValid = safeCompareSignatures(receivedSignature, expectedSignature);

    if (!isValid) {
      return {
        verified: false,
        error: WebhookErrorMessages[WebhookError.INVALID_SIGNATURE],
      };
    }

    // Parse the payload
    const parseResult = safeParseJson<GitHubWebhookEvent>(payload);
    if (!parseResult.success) {
      return {
        verified: false,
        error: parseResult.error ?? WebhookErrorMessages[WebhookError.INVALID_PAYLOAD],
      };
    }

    return {
      verified: true,
      event: parseResult.data,
    };
  } catch (error) {
    return {
      verified: false,
      error:
        error instanceof Error
          ? error.message
          : WebhookErrorMessages[WebhookError.INTERNAL_ERROR],
    };
  }
}

/**
 * Verify a GitHub webhook from Headers object
 *
 * Convenience wrapper that extracts the signature from request headers.
 *
 * @param payload - Raw webhook payload (as string)
 * @param headers - Request headers (Headers API or plain object)
 * @param secret - Your GitHub webhook secret
 * @returns Verification result with event data if successful
 *
 * @example
 * ```ts
 * // With Next.js Request
 * const rawPayload = await request.text();
 * const result = await verifyGitHubWebhookFromHeaders(
 *   rawPayload,
 *   request.headers,
 *   env.GITHUB_WEBHOOK_SECRET
 * );
 * ```
 */
export async function verifyGitHubWebhookFromHeaders(
  payload: string,
  headers: Headers | Record<string, string | undefined>,
  secret: string,
): Promise<GitHubWebhookVerificationResult> {
  const signature =
    headers instanceof Headers
      ? headers.get(GITHUB_SIGNATURE_HEADER)
      : (headers[GITHUB_SIGNATURE_HEADER] ??
          headers[GITHUB_SIGNATURE_HEADER.toLowerCase()] ??
          null);

  return verifyGitHubWebhook(payload, signature, secret);
}

/**
 * Extract GitHub webhook metadata from headers
 *
 * Returns useful metadata like delivery ID and event type for logging.
 *
 * @param headers - Request headers (Headers API or plain object)
 * @returns Object with delivery ID and event type
 *
 * @example
 * ```ts
 * const metadata = extractGitHubWebhookMetadata(request.headers);
 * console.log(`GitHub webhook: ${metadata.eventType} (delivery: ${metadata.deliveryId})`);
 * ```
 */
export function extractGitHubWebhookMetadata(
  headers: Headers | Record<string, string | undefined>,
): {
  deliveryId: string | null;
  eventType: string | null;
} {
  const getHeader = (name: string): string | null => {
    if (headers instanceof Headers) {
      return headers.get(name);
    }
    return headers[name] ?? headers[name.toLowerCase()] ?? null;
  };

  return {
    deliveryId: getHeader(GITHUB_DELIVERY_ID_HEADER),
    eventType: getHeader(GITHUB_EVENT_HEADER),
  };
}

/**
 * Verify GitHub webhook signature with timestamp validation
 *
 * Extended verification that also checks if the webhook is recent.
 * Note: GitHub webhooks don't include timestamps in the signature,
 * so this only validates recency, not prevents replay attacks fully.
 *
 * @param payload - Raw webhook payload
 * @param signature - The X-Hub-Signature-256 header value
 * @param secret - Your GitHub webhook secret
 * @param options - Optional configuration
 * @returns Verification result
 *
 * @example
 * ```ts
 * const result = await verifyGitHubWebhookWithTimestamp(
 *   payload,
 *   signature,
 *   secret,
 *   { maxAgeSeconds: 300 } // 5 minutes
 * );
 * ```
 */
export async function verifyGitHubWebhookWithTimestamp(
  payload: string,
  signature: string | null,
  secret: string,
  options?: {
    maxAgeSeconds?: number;
    timestampHeader?: string;
  },
): Promise<GitHubWebhookVerificationResult> {
  // First verify the signature
  const result = await verifyGitHubWebhook(payload, signature, secret);

  if (!result.verified) {
    return result;
  }

  // If timestamp validation is requested, check timestamp
  if (options?.timestampHeader && result.event) {
    const event = result.event as Record<string, unknown>;
    const timestamp = event[options.timestampHeader] as string | undefined;

    if (timestamp) {
      const isValid = validateWebhookTimestamp(
        timestamp,
        options.maxAgeSeconds,
      );
      if (!isValid) {
        return {
          verified: false,
          error: WebhookErrorMessages[WebhookError.TIMESTAMP_TOO_OLD],
        };
      }
    }
  }

  return result;
}

/**
 * Default max age for GitHub webhooks (5 minutes)
 * Used for replay attack prevention
 */
export const GITHUB_MAX_WEBHOOK_AGE_SECONDS = 300;

/**
 * Extract timestamp from GitHub webhook payload for validation
 *
 * Different event types have timestamps in different fields.
 * Returns null if no timestamp can be extracted.
 *
 * @param payload - Parsed GitHub webhook payload
 * @param eventType - The x-github-event header value
 * @returns ISO timestamp string or null
 *
 * @example
 * ```ts
 * const timestamp = extractGitHubPayloadTimestamp(payload, "push");
 * if (timestamp) {
 *   const isValid = validateWebhookTimestamp(timestamp, 300);
 * }
 * ```
 */
export function extractGitHubPayloadTimestamp(
  payload: GitHubWebhookEvent,
  eventType: string
): string | null {
  // Push events - use head_commit.timestamp
  if (eventType === "push") {
    const pushPayload = payload as { head_commit?: { timestamp?: string } };
    if (pushPayload.head_commit?.timestamp) {
      return pushPayload.head_commit.timestamp;
    }
  }

  // Pull request events - use updated_at
  if (eventType === "pull_request") {
    const prPayload = payload as { pull_request?: { updated_at?: string } };
    if (prPayload.pull_request?.updated_at) {
      return prPayload.pull_request.updated_at;
    }
  }

  // Issue events - use updated_at
  if (eventType === "issues") {
    const issuePayload = payload as { issue?: { updated_at?: string } };
    if (issuePayload.issue?.updated_at) {
      return issuePayload.issue.updated_at;
    }
  }

  // Discussion events - use updated_at
  if (eventType === "discussion") {
    const discussionPayload = payload as { discussion?: { updated_at?: string } };
    if (discussionPayload.discussion?.updated_at) {
      return discussionPayload.discussion.updated_at;
    }
  }

  // Release events - use published_at or created_at
  if (eventType === "release") {
    const releasePayload = payload as {
      release?: { published_at?: string; created_at?: string };
    };
    if (releasePayload.release?.published_at) {
      return releasePayload.release.published_at;
    }
    if (releasePayload.release?.created_at) {
      return releasePayload.release.created_at;
    }
  }

  return null;
}
