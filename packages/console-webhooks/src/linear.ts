/**
 * Linear webhook verification utilities (STUB)
 *
 * This module provides webhook verification for Linear.
 * Implementation follows Linear's webhook signature verification spec.
 *
 * @see https://developers.linear.app/docs/graphql/webhooks
 *
 * TODO: Implement Linear webhook verification when Linear integration is added
 */

import {
  computeHmacSignature,
  safeCompareSignatures,
  safeParseJson,
  validateWebhookTimestamp,
} from "./common.js";
import type { LinearWebhookVerificationResult, LinearWebhookEvent } from "./types.js";
import { WebhookError, WebhookErrorMessages } from "./types.js";

/**
 * Linear webhook signature header name
 * Note: Update this when implementing based on Linear's documentation
 */
export const LINEAR_SIGNATURE_HEADER = "linear-signature";

/**
 * Linear webhook timestamp header
 * Note: Update this when implementing based on Linear's documentation
 */
export const LINEAR_TIMESTAMP_HEADER = "linear-timestamp";

/**
 * Verify a Linear webhook signature
 *
 * STUB: This is a placeholder implementation. Update when Linear integration is added.
 *
 * Linear webhook verification typically involves:
 * 1. Extract signature from headers
 * 2. Extract timestamp from headers
 * 3. Validate timestamp is recent (prevent replay attacks)
 * 4. Compute HMAC signature using payload + timestamp
 * 5. Compare signatures using timing-safe comparison
 *
 * @param payload - Raw webhook payload (as string)
 * @param signature - The Linear signature header value
 * @param secret - Your Linear webhook secret
 * @returns Verification result with event data if successful
 *
 * @example
 * ```ts
 * // When implementing Linear integration:
 * const result = await verifyLinearWebhook(payload, signature, secret);
 * if (result.verified) {
 *   console.log("Linear event:", result.event);
 * }
 * ```
 */
export async function verifyLinearWebhook(
  payload: string,
  signature: string | null,
  secret: string,
): Promise<LinearWebhookVerificationResult> {
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

  // TODO: Implement Linear-specific verification logic
  // This is a stub - update when Linear integration is added
  return {
    verified: false,
    error: "Linear webhook verification not yet implemented",
  };
}

/**
 * Verify a Linear webhook from Headers object
 *
 * STUB: Convenience wrapper that extracts headers. Update when implementing.
 *
 * @param payload - Raw webhook payload
 * @param headers - Request headers
 * @param secret - Your Linear webhook secret
 * @returns Verification result
 */
export async function verifyLinearWebhookFromHeaders(
  payload: string,
  headers: Headers | Record<string, string | undefined>,
  secret: string,
): Promise<LinearWebhookVerificationResult> {
  const signature =
    headers instanceof Headers
      ? headers.get(LINEAR_SIGNATURE_HEADER)
      : (headers[LINEAR_SIGNATURE_HEADER] ??
          headers[LINEAR_SIGNATURE_HEADER.toLowerCase()] ??
          null);

  return verifyLinearWebhook(payload, signature, secret);
}

/**
 * Extract Linear webhook metadata from headers
 *
 * STUB: Update header names when implementing.
 *
 * @param headers - Request headers
 * @returns Object with webhook metadata
 */
export function extractLinearWebhookMetadata(
  headers: Headers | Record<string, string | undefined>,
): {
  timestamp: string | null;
  eventType: string | null;
} {
  const getHeader = (name: string): string | null => {
    if (headers instanceof Headers) {
      return headers.get(name);
    }
    return headers[name] ?? headers[name.toLowerCase()] ?? null;
  };

  return {
    timestamp: getHeader(LINEAR_TIMESTAMP_HEADER),
    eventType: null, // TODO: Add Linear event type header when known
  };
}
