import { ResultAsync } from "neverthrow";

import { env } from "~/env";

export const REQUEST_ID_HEADER = "x-request-id";
export const REQUEST_ID_PREFIX = "lf_";

// Error classes
export class RequestIdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestIdError";
  }
}

export class RequestIdMissingError extends RequestIdError {
  constructor(message = "No request ID found in headers.") {
    super(message);
    this.name = "RequestIdMissingError";
  }
}

export class RequestIdInvalidError extends RequestIdError {
  constructor(message = "Invalid request ID format.") {
    super(message);
    this.name = "RequestIdInvalidError";
  }
}

export class RequestIdExpiredError extends RequestIdError {
  constructor(message = "Request ID has expired.") {
    super(message);
    this.name = "RequestIdExpiredError";
  }
}

export class RequestIdSignatureError extends RequestIdError {
  constructor(message = "Invalid request ID signature.") {
    super(message);
    this.name = "RequestIdSignatureError";
  }
}

export type RequestIdErrorType =
  | RequestIdMissingError
  | RequestIdInvalidError
  | RequestIdExpiredError
  | RequestIdSignatureError
  | RequestIdError;

/**
 * Generates a cryptographically secure request ID using WebCrypto
 * Format: lf_<timestamp>_<random>_<signature>
 */
export async function generateSignedRequestId(): Promise<string> {
  // Get current timestamp and random value
  const timestamp = Date.now().toString(36);
  const randomBytes = crypto.getRandomValues(new Uint8Array(16));
  const random = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Create the base request ID
  const baseId = `${REQUEST_ID_PREFIX}${timestamp}_${random}`;

  // Create signature using HMAC
  const encoder = new TextEncoder();
  const keyData = encoder.encode(env.REQUEST_ID_SECRET);

  // @NOTE: Crypto.subtle might not be available in some environments
  // @TODO: Remove this once we have a better solution
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(baseId),
  );

  // Convert signature to base64url
  const signatureBase64 = Buffer.from(signature)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  // Take first 16 chars of signature for brevity
  return `${baseId}_${signatureBase64.slice(0, 16)}`;
}

/**
 * Validates a signed request ID
 * Returns true if the ID is valid and not expired
 */
async function validateRequestIdUnsafe(
  requestId: string | null,
): Promise<string> {
  // Check if request ID exists
  if (!requestId) {
    throw new RequestIdMissingError();
  }

  // Check prefix
  if (!requestId.startsWith(REQUEST_ID_PREFIX)) {
    throw new RequestIdInvalidError("Invalid request ID prefix.");
  }

  // Split the components
  const [prefix, timestamp, random, signature] = requestId.split("_");
  if (!prefix || !timestamp || !random || !signature) {
    throw new RequestIdInvalidError("Malformed request ID.");
  }

  // Check timestamp (expire after 5 minutes)
  const requestTime = parseInt(timestamp, 36);
  const now = Date.now();
  if (now - requestTime > 5 * 60 * 1000) {
    throw new RequestIdExpiredError();
  }

  // Reconstruct base ID for signature verification
  const baseId = `${prefix}_${timestamp}_${random}`;

  // Import key and verify signature
  const encoder = new TextEncoder();
  const keyData = encoder.encode(env.REQUEST_ID_SECRET);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const expectedSignature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(baseId),
  );

  // Convert expected signature to base64url
  const expectedBase64 = btoa(
    String.fromCharCode(...new Uint8Array(expectedSignature)),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
    .slice(0, 16);

  if (signature !== expectedBase64) {
    throw new RequestIdSignatureError();
  }

  return baseId;
}

/**
 * Safe version of validateRequestId that returns a Result
 */
export const validateRequestIdSafe = (requestId: string | null) =>
  ResultAsync.fromPromise(
    validateRequestIdUnsafe(requestId),
    (error): RequestIdErrorType => {
      // If it's already one of our error types, return it
      if (
        error instanceof RequestIdMissingError ||
        error instanceof RequestIdInvalidError ||
        error instanceof RequestIdExpiredError ||
        error instanceof RequestIdSignatureError ||
        error instanceof RequestIdError
      ) {
        return error;
      }
      // Otherwise wrap in RequestIdError
      return new RequestIdError(
        error instanceof Error ? error.message : "Unknown request ID error",
      );
    },
  );

/**
 * Extracts the timestamp from a request ID
 * Returns undefined if the ID is invalid
 */
export function getRequestIdTimestamp(requestId: string): number | undefined {
  try {
    const [prefix, timestamp] = requestId.split("_");
    if (!prefix || !timestamp || prefix !== REQUEST_ID_PREFIX) {
      return undefined;
    }
    return parseInt(timestamp, 36);
  } catch {
    return undefined;
  }
}
