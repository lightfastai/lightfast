import { describe, expect, it } from "vitest";

import {
  nativeRpcAuthSessionInputSchema,
  nativeRpcAuthSessionSuccessResponseSchema,
  nativeRpcCommandNames,
  nativeRpcErrorResponseSchema,
  nativeRpcRequestSchema,
} from "../native-rpc";

describe("@repo/native-auth-contract native RPC", () => {
  it("defines a small first-party native command vocabulary", () => {
    expect(nativeRpcCommandNames).toEqual(["auth.session"]);
    expect(nativeRpcRequestSchema.parse({ command: "auth.session" })).toEqual({
      command: "auth.session",
    });
    expect(() =>
      nativeRpcRequestSchema.parse({ command: "signals.list" })
    ).toThrow();
  });

  it("keeps auth.session input empty and explicit", () => {
    expect(nativeRpcAuthSessionInputSchema.parse({})).toEqual({});
    expect(() =>
      nativeRpcAuthSessionInputSchema.parse({ organizationId: "org_1" })
    ).toThrow();
  });

  it("validates native RPC success and error envelopes", () => {
    expect(
      nativeRpcAuthSessionSuccessResponseSchema.parse({
        ok: true,
        result: {
          client: "desktop",
          organization: { id: "org_1", name: "Acme", slug: "acme" },
          user: { email: "dev@example.com", id: "user_1" },
        },
      })
    ).toMatchObject({
      ok: true,
      result: { client: "desktop", organization: { id: "org_1" } },
    });

    expect(
      nativeRpcErrorResponseSchema.parse({
        ok: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Lightfast native OAuth authentication required.",
        },
      })
    ).toEqual({
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Lightfast native OAuth authentication required.",
      },
    });
  });
});
