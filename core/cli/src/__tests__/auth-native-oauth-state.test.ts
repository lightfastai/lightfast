// SPDX-License-Identifier: Apache-2.0
// Relocated into the CLI; see ../../NOTICE and ../../LICENSE-APACHE-2.0.

import { describe, expect, it } from "vitest";
import { NativeAuthError } from "../auth/native-errors";
import {
  assertNativeOAuthState,
  decodeNativeOAuthState,
} from "../auth/oauth-state";

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

describe("CLI auth OAuth state", () => {
  it("decodes native OAuth state envelopes", () => {
    expect(
      decodeNativeOAuthState(
        encode({ attemptId: "attempt_123456789", nonce: "nonce_1234567890" })
      )
    ).toEqual({
      attemptId: "attempt_123456789",
      nonce: "nonce_1234567890",
    });
  });

  it("returns the envelope when the nonce matches", () => {
    const state = encode({
      attemptId: "attempt_123456789",
      nonce: "nonce_1234567890",
    });

    expect(
      assertNativeOAuthState({
        expectedNonce: "nonce_1234567890",
        state,
      })
    ).toMatchObject({ attemptId: "attempt_123456789" });
  });

  it("throws a typed error when the nonce mismatches", () => {
    const state = encode({
      attemptId: "attempt_123456789",
      nonce: "nonce_1234567890",
    });

    expect(() =>
      assertNativeOAuthState({ expectedNonce: "other_nonce_1234", state })
    ).toThrow(NativeAuthError);
  });
});
