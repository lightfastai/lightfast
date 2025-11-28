/**
 * Common webhook verification utilities
 *
 * Provides shared functions for:
 * - Timing-attack resistant signature comparison
 * - Timestamp validation
 * - HMAC signature generation
 */

import { WebhookError, WebhookErrorMessages } from "./types.js";

/**
 * Maximum age (in seconds) for webhook timestamps before they are considered expired
 * Default: 5 minutes (300 seconds)
 */
export const DEFAULT_MAX_TIMESTAMP_AGE_SECONDS = 300;

/**
 * Safely compare two strings in constant time to prevent timing attacks
 *
 * Uses Node.js crypto.timingSafeEqual for timing-attack resistance.
 *
 * @param received - The received signature/value
 * @param expected - The expected signature/value
 * @returns True if the strings match
 *
 * @example
 * ```ts
 * const isValid = safeCompareSignatures(receivedSig, computedSig);
 * ```
 */
export function safeCompareSignatures(
  received: string,
  expected: string,
): boolean {
  // Ensure both strings are the same length to prevent timing attacks
  if (received.length !== expected.length) {
    return false;
  }

  try {
    // Use Node.js crypto.timingSafeEqual for timing-attack resistance
    const receivedBuffer = Buffer.from(received, "utf-8");
    const expectedBuffer = Buffer.from(expected, "utf-8");

    // Import crypto synchronously from Node.js
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require("node:crypto") as typeof import("node:crypto");
    return crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
  } catch {
    // Fallback to manual comparison if crypto is not available
    // This is less secure but better than nothing
    let result = 0;
    for (let i = 0; i < received.length; i++) {
      result |= received.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    return result === 0;
  }
}

/**
 * Validate that a webhook timestamp is within an acceptable age
 *
 * Used to prevent replay attacks by ensuring webhooks are recent.
 *
 * @param timestamp - The timestamp to validate (Unix timestamp in seconds or ISO 8601 string)
 * @param maxAgeSeconds - Maximum age in seconds (default: 300 = 5 minutes)
 * @returns True if the timestamp is valid and not too old
 *
 * @example
 * ```ts
 * // Unix timestamp
 * const isRecent = validateWebhookTimestamp("1640995200", 300);
 *
 * // ISO 8601 timestamp
 * const isRecent = validateWebhookTimestamp("2021-12-31T12:00:00Z", 300);
 * ```
 */
export function validateWebhookTimestamp(
  timestamp: string | number,
  maxAgeSeconds: number = DEFAULT_MAX_TIMESTAMP_AGE_SECONDS,
): boolean {
  try {
    let timestampMs: number;

    // Parse timestamp - support both Unix timestamps and ISO 8601
    if (typeof timestamp === "number") {
      // Assume seconds, convert to milliseconds
      timestampMs = timestamp * 1000;
    } else if (typeof timestamp === "string") {
      // Try parsing as Unix timestamp (seconds)
      const parsed = Number.parseInt(timestamp, 10);
      if (!Number.isNaN(parsed)) {
        timestampMs = parsed * 1000;
      } else {
        // Try parsing as ISO 8601
        timestampMs = new Date(timestamp).getTime();
      }
    } else {
      return false;
    }

    // Check if timestamp is valid
    if (Number.isNaN(timestampMs) || timestampMs <= 0) {
      return false;
    }

    // Check if timestamp is not in the future (with 1 minute tolerance for clock skew)
    const now = Date.now();
    const oneMinute = 60 * 1000;
    if (timestampMs > now + oneMinute) {
      return false;
    }

    // Check if timestamp is within acceptable age
    const age = (now - timestampMs) / 1000; // Convert to seconds
    return age <= maxAgeSeconds;
  } catch {
    return false;
  }
}

/**
 * Compute HMAC SHA-256 signature for a payload
 *
 * @param payload - The payload to sign (string)
 * @param secret - The secret key for HMAC
 * @returns Hex-encoded HMAC SHA-256 signature
 *
 * @example
 * ```ts
 * const signature = await computeHmacSignature(payload, secret);
 * // Returns: "abc123...def456" (64 character hex string)
 * ```
 */
export async function computeHmacSignature(
  payload: string,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);

  // Import the secret key for HMAC
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
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
 * Parse JSON safely and return a structured result
 *
 * @param jsonString - The JSON string to parse
 * @returns Object with parsed data or error
 *
 * @example
 * ```ts
 * const result = safeParseJson('{"key": "value"}');
 * if (result.success) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export function safeParseJson<T = unknown>(jsonString: string): {
  success: boolean;
  data?: T;
  error?: string;
} {
  try {
    const data = JSON.parse(jsonString) as T;
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : WebhookErrorMessages[WebhookError.INVALID_PAYLOAD],
    };
  }
}

/**
 * Extract timestamp from webhook headers
 *
 * Different webhook providers use different header names for timestamps.
 *
 * @param headers - Headers object (Headers API or plain object)
 * @param headerName - Name of the timestamp header
 * @returns The timestamp string or null if not found
 *
 * @example
 * ```ts
 * // With Headers API
 * const timestamp = extractTimestamp(request.headers, "x-webhook-timestamp");
 *
 * // With plain object
 * const timestamp = extractTimestamp({"x-webhook-timestamp": "1640995200"}, "x-webhook-timestamp");
 * ```
 */
export function extractTimestamp(
  headers: Headers | Record<string, string | undefined>,
  headerName: string,
): string | null {
  if (headers instanceof Headers) {
    return headers.get(headerName);
  }
  return headers[headerName] ?? headers[headerName.toLowerCase()] ?? null;
}
