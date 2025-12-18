/**
 * @repo/console-webhooks
 *
 * Webhook signature verification utilities for Console integrations
 *
 * This package provides cryptographic verification utilities for:
 * - Verifying GitHub webhook signatures (HMAC SHA-256)
 * - Verifying Vercel webhook signatures
 * - Timing-attack resistant signature comparison
 * - Timestamp validation to prevent replay attacks
 * - Common webhook verification utilities
 *
 * ## Security Features
 *
 * - **Timing-attack resistance**: Uses `crypto.timingSafeEqual()` for signature comparison
 * - **Replay attack prevention**: Validates webhook timestamps
 * - **HMAC verification**: Industry-standard HMAC SHA-256 signatures
 * - **Type-safe results**: Structured verification results with error details
 *
 * @example
 * ```ts
 * // GitHub webhook verification
 * import { verifyGitHubWebhookFromHeaders } from "@repo/console-webhooks/github";
 *
 * const rawPayload = await request.text();
 * const result = await verifyGitHubWebhookFromHeaders(
 *   rawPayload,
 *   request.headers,
 *   env.GITHUB_WEBHOOK_SECRET
 * );
 *
 * if (result.verified) {
 *   // Process webhook event
 *   console.log("Repository:", result.event?.repository?.full_name);
 * } else {
 *   // Reject invalid webhook
 *   return new Response(result.error, { status: 401 });
 * }
 * ```
 *
 * @example
 * ```ts
 * // Using common utilities directly
 * import { computeHmacSignature, safeCompareSignatures } from "@repo/console-webhooks/common";
 *
 * const signature = await computeHmacSignature(payload, secret);
 * const isValid = safeCompareSignatures(receivedSig, signature);
 * ```
 */

// Re-export everything from submodules
export * from "./types.js";
export * from "./common.js";
export * from "./github.js";
export * from "./vercel.js";

// Validation utilities
export * from "./validation.js";

// Sanitization utilities
export * from "./sanitize.js";

// Event mapping utilities
export * from "./event-mapping.js";

// Transformers
export * from "./transformers/index.js";
