import { env } from "../env.js";

/**
 * Returns the validated ENCRYPTION_KEY.
 * Safe because env is validated at startup via @t3-oss/env-core.
 * Throws early if called during skip-validation mode without a key.
 */
export function getEncryptionKey(): string {
  const key = env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "ENCRYPTION_KEY is required but not set. " +
        "This should not happen in production — env validation ensures it exists."
    );
  }
  return key;
}
