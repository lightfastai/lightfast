import { z } from "zod";

import { NativeAuthError } from "./errors";

export const nativeOAuthStateEnvelopeSchema = z.object({
  attemptId: z.string().min(16),
  nonce: z.string().min(16),
});

export type NativeOAuthStateEnvelope = z.infer<
  typeof nativeOAuthStateEnvelopeSchema
>;

export function decodeNativeOAuthState(state: string): NativeOAuthStateEnvelope {
  try {
    const json = Buffer.from(state, "base64url").toString("utf8");
    return nativeOAuthStateEnvelopeSchema.parse(JSON.parse(json));
  } catch (error) {
    throw new NativeAuthError(
      "OAUTH_STATE_INVALID",
      "OAuth state is invalid."
    );
  }
}

export function assertNativeOAuthState(input: {
  expectedNonce: string;
  state: string;
}): NativeOAuthStateEnvelope {
  const envelope = decodeNativeOAuthState(input.state);
  if (envelope.nonce !== input.expectedNonce) {
    throw new NativeAuthError("OAUTH_STATE_MISMATCH", "OAuth state mismatch.");
  }
  return envelope;
}
