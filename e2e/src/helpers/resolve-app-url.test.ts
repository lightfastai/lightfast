import { describe, expect, it } from "vitest";

import { resolveE2EApiBase, resolveE2EAppUrl } from "./resolve-app-url";

describe("resolveE2EAppUrl", () => {
  it("uses LIGHTFAST_E2E_APP_URL when provided", () => {
    expect(
      resolveE2EAppUrl({
        env: {
          LIGHTFAST_E2E_APP_URL: "https://custom.app.lightfast.localhost/",
        },
      })
    ).toBe("https://custom.app.lightfast.localhost");
  });

  it("derives the app host through direct Portless lookup", () => {
    expect(
      resolveE2EAppUrl({
        env: {},
        getPortlessUrl: (name) =>
          name === "app.lightfast"
            ? "https://feat-signal-smoke.app.lightfast.localhost/"
            : undefined,
      })
    ).toBe("https://feat-signal-smoke.app.lightfast.localhost");
  });
});

describe("resolveE2EApiBase", () => {
  it("keeps LIGHTFAST_SIGNAL_API_BASE as a compatibility override", () => {
    expect(
      resolveE2EApiBase({
        env: {
          LIGHTFAST_SIGNAL_API_BASE: "https://legacy.example.test/api/v1/",
        },
      })
    ).toBe("https://legacy.example.test/api/v1");
  });

  it("derives /api/v1 from the resolved app URL", () => {
    expect(
      resolveE2EApiBase({
        env: {
          LIGHTFAST_E2E_APP_URL: "https://wt.app.lightfast.localhost/",
        },
      })
    ).toBe("https://wt.app.lightfast.localhost/api/v1");
  });
});
