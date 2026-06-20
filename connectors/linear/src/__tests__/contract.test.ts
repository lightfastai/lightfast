import { describe, expect, it } from "vitest";

import { LINEAR_OAUTH_SCOPE, LINEAR_OAUTH_SCOPES } from "../contract";
import { LINEAR_OAUTH_SCOPE as runtimeLinearOAuthScope } from "../oauth";

describe("Linear connector contract", () => {
  it("owns the public OAuth scope contract separately from OAuth runtime code", () => {
    expect(LINEAR_OAUTH_SCOPES).toEqual(["read", "write"]);
    expect(LINEAR_OAUTH_SCOPE).toBe(LINEAR_OAUTH_SCOPES.join(","));
    expect(runtimeLinearOAuthScope).toBe(LINEAR_OAUTH_SCOPE);
  });
});
