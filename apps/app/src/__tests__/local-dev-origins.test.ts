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
        "https://debug-auth-local-infra.platform.lightfast.localhost",
      ])
    ).toEqual([
      "debug-auth-local-infra.app.lightfast.localhost",
      "debug-auth-local-infra.lightfast.localhost",
      "debug-auth-local-infra.www.lightfast.localhost",
      "debug-auth-local-infra.platform.lightfast.localhost",
    ]);
  });

  it("keeps server action hosts scoped to exact injected service hosts", () => {
    expect(
      localServerActionHosts([
        "https://debug-auth-local-infra.app.lightfast.localhost",
        "https://debug-auth-local-infra.www.lightfast.localhost",
        "https://debug-auth-local-infra.platform.lightfast.localhost",
      ])
    ).toEqual([
      "debug-auth-local-infra.app.lightfast.localhost",
      "debug-auth-local-infra.www.lightfast.localhost",
      "debug-auth-local-infra.platform.lightfast.localhost",
    ]);
  });
});
