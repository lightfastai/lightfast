import { describe, expect, it } from "vitest";

import {
  localAllowedDevOrigins,
  localServerActionHosts,
} from "../local-dev-origins";

describe("local dev origins", () => {
  it("derives direct service and aggregate hosts for a worktree app URL", () => {
    expect(
      localAllowedDevOrigins([
        "https://debug-auth-local-infra.app.lightfast.localhost",
        "https://debug-auth-local-infra.www.lightfast.localhost",
      ])
    ).toEqual([
      "debug-auth-local-infra.app.lightfast.localhost",
      "debug-auth-local-infra.lightfast.localhost",
      "debug-auth-local-infra.www.lightfast.localhost",
    ]);
  });

  it("derives the direct app host from the aggregate MFE URL", () => {
    expect(
      localAllowedDevOrigins([
        "https://debug-auth-local-infra.lightfast.localhost",
      ])
    ).toEqual([
      "debug-auth-local-infra.lightfast.localhost",
      "debug-auth-local-infra.app.lightfast.localhost",
    ]);
  });

  it("derives the direct app host from the canonical aggregate URL", () => {
    expect(localAllowedDevOrigins(["https://lightfast.localhost"])).toEqual([
      "lightfast.localhost",
      "app.lightfast.localhost",
    ]);
  });

  it("derives the canonical aggregate host from the direct app URL", () => {
    expect(localAllowedDevOrigins(["https://app.lightfast.localhost"])).toEqual(
      ["app.lightfast.localhost", "lightfast.localhost"]
    );
  });

  it("keeps canonical direct service hosts exact", () => {
    expect(
      localAllowedDevOrigins([
        "https://app.lightfast.localhost",
        "https://www.lightfast.localhost",
      ])
    ).toEqual([
      "app.lightfast.localhost",
      "lightfast.localhost",
      "www.lightfast.localhost",
    ]);
  });

  it("preserves ports when deriving direct service and aggregate hosts", () => {
    expect(
      localAllowedDevOrigins([
        "https://debug-auth-local-infra.app.lightfast.localhost:4107",
        "https://debug-auth-local-infra.lightfast.localhost:4108",
      ])
    ).toEqual([
      "debug-auth-local-infra.app.lightfast.localhost:4107",
      "debug-auth-local-infra.lightfast.localhost:4107",
      "debug-auth-local-infra.lightfast.localhost:4108",
      "debug-auth-local-infra.app.lightfast.localhost:4108",
    ]);
  });

  it("does not derive app hosts for multi-level aggregate subdomains", () => {
    expect(
      localAllowedDevOrigins(["https://feature.debug.lightfast.localhost"])
    ).toEqual(["feature.debug.lightfast.localhost"]);
  });

  it("keeps server action hosts scoped to exact injected service hosts", () => {
    expect(
      localServerActionHosts([
        "https://debug-auth-local-infra.app.lightfast.localhost",
        "https://debug-auth-local-infra.www.lightfast.localhost",
      ])
    ).toEqual([
      "debug-auth-local-infra.app.lightfast.localhost",
      "debug-auth-local-infra.www.lightfast.localhost",
    ]);
  });
});
