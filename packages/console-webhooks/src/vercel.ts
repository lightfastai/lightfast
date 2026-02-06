/**
 * Vercel webhook verification utilities
 *
 * Provides functions for verifying Vercel integration webhook signatures using HMAC SHA-1.
 *
 * Vercel integration webhooks use the x-vercel-signature header with HMAC-SHA1 (hex-encoded).
 *
 * IMPORTANT: Vercel integration webhooks use the CLIENT_INTEGRATION_SECRET for verification,
 * not a separate webhook secret (per Vercel documentation).
 *
 * @see https://vercel.com/docs/integrations/webhooks
 */

import {
  safeCompareSignatures,
  safeParseJson,
} from "./common.js";
import type {
  WebhookVerificationResult,
} from "./types.js";
import { WebhookError, WebhookErrorMessages } from "./types.js";

/**
 * Vercel webhook signature header name
 */
export const VERCEL_SIGNATURE_HEADER = "x-vercel-signature";

/**
 * Vercel webhook ID header (for logging/debugging)
 */
export const VERCEL_WEBHOOK_ID_HEADER = "x-vercel-id";

/**
 * Vercel deployment event types
 */
export type VercelDeploymentEvent =
  | "deployment.created"
  | "deployment.succeeded"
  | "deployment.ready"
  | "deployment.error"
  | "deployment.canceled"
  | "deployment.check-rerequested";

/**
 * Vercel marketplace event types
 */
export type VercelMarketplaceEvent =
  | "marketplace.invoice.created"
  | "marketplace.invoice.paid"
  | "marketplace.invoice.notpaid"
  | "marketplace.invoice.refunded";

/**
 * Vercel integration action event types
 */
export type VercelIntegrationActionEvent =
  | "deployment.integration.action.start"
  | "deployment.integration.action.cancel"
  | "deployment.integration.action.cleanup";

/**
 * Vercel integration configuration event types
 */
export type VercelConfigurationEvent = "integration-configuration.removed";

/**
 * All Vercel webhook event types
 */
export type VercelWebhookEventType =
  | VercelDeploymentEvent
  | VercelMarketplaceEvent
  | VercelIntegrationActionEvent
  | VercelConfigurationEvent;

/**
 * Vercel webhook payload structure
 */
export interface VercelWebhookPayload {
  /**
   * Unique webhook event identifier
   */
  id: string;

  /**
   * Event type (e.g., "deployment.created")
   */
  type: VercelWebhookEventType;

  /**
   * Unix timestamp (milliseconds) when event was created
   */
  createdAt: number;

  /**
   * Region where the webhook originated
   */
  region?: string;

  /**
   * Event payload data
   */
  payload: {
    /**
     * Deployment data (for deployment events)
     */
    deployment?: {
      /**
       * Unique deployment identifier
       */
      id: string;

      /**
       * Deployment name (usually project name)
       */
      name: string;

      /**
       * Deployment URL (without protocol)
       */
      url?: string;

      /**
       * Ready state
       */
      readyState?: "READY" | "ERROR" | "BUILDING" | "QUEUED" | "CANCELED";

      /**
       * Error code (if deployment failed)
       */
      errorCode?: string;

      /**
       * Git metadata (if deployment from git)
       */
      meta?: {
        githubCommitSha?: string;
        githubCommitRef?: string;
        githubCommitMessage?: string;
        githubCommitAuthorName?: string;
        githubCommitAuthorLogin?: string;
        githubOrg?: string;
        githubRepo?: string;
        githubDeployment?: string;
        githubCommitOrg?: string;
        githubCommitRepo?: string;
        githubCommitRepoId?: string;
        /** PR number (undocumented but may be present for PR deployments) */
        githubPrId?: string;
      };
    };

    /**
     * Project data
     */
    project?: {
      /**
       * Project identifier
       */
      id: string;

      /**
       * Project name
       */
      name: string;
    };

    /**
     * Team data (for team deployments)
     */
    team?: {
      /**
       * Team identifier
       */
      id: string;

      /**
       * Team slug
       */
      slug?: string;

      /**
       * Team name
       */
      name?: string;
    };

    /**
     * User data (for personal deployments)
     */
    user?: {
      /**
       * User identifier
       */
      id: string;
    };

    /**
     * Additional event-specific data
     */
    [key: string]: unknown;
  };
}

/**
 * Vercel webhook verification result
 */
export type VercelWebhookVerificationResult =
  WebhookVerificationResult<VercelWebhookPayload>;

/**
 * Compute HMAC SHA-1 signature for a payload
 *
 * Vercel uses SHA-1 instead of SHA-256 for webhook signatures.
 *
 * @param payload - The payload to sign (string)
 * @param secret - The secret key for HMAC (CLIENT_INTEGRATION_SECRET)
 * @returns Hex-encoded HMAC SHA-1 signature
 *
 * @example
 * ```ts
 * const signature = await computeHmacSha1Signature(payload, secret);
 * // Returns: "abc123...def456" (40 character hex string)
 * ```
 */
async function computeHmacSha1Signature(
  payload: string,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);

  // Import the secret key for HMAC with SHA-1
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );

  // Compute the HMAC signature
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, messageData);

  // Convert to hex string
  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  return signatureArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verify a Vercel webhook signature
 *
 * This function:
 * 1. Validates the payload is not empty
 * 2. Extracts the signature from the header
 * 3. Computes the expected HMAC SHA-1 signature
 * 4. Compares signatures using timing-attack resistant comparison
 * 5. Parses and returns the event data if valid
 *
 * @param payload - Raw webhook payload (as string, not parsed)
 * @param signature - The x-vercel-signature header value
 * @param secret - Your Vercel CLIENT_INTEGRATION_SECRET
 * @returns Verification result with event data if successful
 *
 * @example
 * ```ts
 * // In your webhook route handler
 * const rawPayload = await request.text();
 * const signature = request.headers.get("x-vercel-signature");
 * const secret = env.VERCEL_CLIENT_INTEGRATION_SECRET;
 *
 * const result = await verifyVercelWebhook(rawPayload, signature, secret);
 *
 * if (result.verified) {
 *   console.log("Deployment:", result.payload?.payload.deployment?.id);
 *   // Process the webhook...
 * } else {
 *   console.error("Verification failed:", result.error);
 *   return new Response("Unauthorized", { status: 401 });
 * }
 * ```
 */
export async function verifyVercelWebhook(
  payload: string,
  signature: string | null,
  secret: string,
): Promise<VercelWebhookVerificationResult> {
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
      error: "Webhook secret is not configured (VERCEL_CLIENT_INTEGRATION_SECRET required)",
    };
  }

  try {
    // Vercel signature is hex-encoded HMAC-SHA1 (no prefix)
    const receivedSignature = signature;

    // Compute expected signature using SHA-1
    const expectedSignature = await computeHmacSha1Signature(payload, secret);

    // Compare signatures using timing-safe comparison
    const isValid = safeCompareSignatures(receivedSignature, expectedSignature);

    if (!isValid) {
      return {
        verified: false,
        error: WebhookErrorMessages[WebhookError.INVALID_SIGNATURE],
      };
    }

    // Parse the payload
    const parseResult = safeParseJson<VercelWebhookPayload>(payload);
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
 * Verify a Vercel webhook from Headers object
 *
 * Convenience wrapper that extracts the signature from request headers.
 *
 * @param payload - Raw webhook payload (as string)
 * @param headers - Request headers (Headers API or plain object)
 * @param secret - Your Vercel CLIENT_INTEGRATION_SECRET
 * @returns Verification result with event data if successful
 *
 * @example
 * ```ts
 * // With Next.js Request
 * const rawPayload = await request.text();
 * const result = await verifyVercelWebhookFromHeaders(
 *   rawPayload,
 *   request.headers,
 *   env.VERCEL_CLIENT_INTEGRATION_SECRET
 * );
 * ```
 */
export async function verifyVercelWebhookFromHeaders(
  payload: string,
  headers: Headers | Record<string, string | undefined>,
  secret: string,
): Promise<VercelWebhookVerificationResult> {
  const signature =
    headers instanceof Headers
      ? headers.get(VERCEL_SIGNATURE_HEADER)
      : (headers[VERCEL_SIGNATURE_HEADER] ??
          headers[VERCEL_SIGNATURE_HEADER.toLowerCase()] ??
          null);

  return verifyVercelWebhook(payload, signature, secret);
}

/**
 * Extract Vercel webhook metadata from headers
 *
 * Returns useful metadata like webhook ID for logging.
 *
 * @param headers - Request headers (Headers API or plain object)
 * @returns Object with webhook ID
 *
 * @example
 * ```ts
 * const metadata = extractVercelWebhookMetadata(request.headers);
 * console.log(`Vercel webhook ID: ${metadata.webhookId}`);
 * ```
 */
export function extractVercelWebhookMetadata(
  headers: Headers | Record<string, string | undefined>,
): {
  webhookId: string | null;
} {
  const getHeader = (name: string): string | null => {
    if (headers instanceof Headers) {
      return headers.get(name);
    }
    return headers[name] ?? headers[name.toLowerCase()] ?? null;
  };

  return {
    webhookId: getHeader(VERCEL_WEBHOOK_ID_HEADER),
  };
}
