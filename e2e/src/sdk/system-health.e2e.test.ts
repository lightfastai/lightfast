import { createLightfast } from "lightfast";
import { describe, expect, it } from "vitest";

import {
  allowLocalhostTls,
  resolveE2EApiKey,
  shouldCheckAppHealth,
} from "../helpers/env";
import { fetchJson } from "../helpers/fetch-json";
import {
  resolveE2EApiBase,
  resolveE2EAppUrl,
} from "../helpers/resolve-app-url";

describe("Lightfast SDK system health E2E smoke", () => {
  it("round-trips through the SDK and live public HTTP API", async () => {
    const appUrl = resolveE2EAppUrl();
    const apiBase = resolveE2EApiBase();
    const apiKey = resolveE2EApiKey();

    allowLocalhostTls(appUrl);
    allowLocalhostTls(apiBase);

    if (shouldCheckAppHealth()) {
      const appHealth = await fetchJson(appUrl, "/api/health", {}, 200);
      expect(appHealth).toEqual(
        expect.objectContaining({
          service: "app",
          status: "ok",
        })
      );
    }

    const lf = createLightfast(apiKey, { baseUrl: appUrl });
    const result = await lf.system.health();

    expect(result.status).toBe("ok");
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(typeof result.version).toBe("string");
  });

  it("rejects requests with an invalid key", async () => {
    const apiBase = resolveE2EApiBase();
    allowLocalhostTls(apiBase);

    await expect(
      fetchJson(
        apiBase,
        "/system/health",
        { headers: { authorization: "Bearer lf_not_a_real_key" } },
        401
      )
    ).resolves.toEqual(
      expect.objectContaining({
        message: "Invalid API key",
      })
    );
  });

  it("rejects requests with no Authorization header", async () => {
    const apiBase = resolveE2EApiBase();
    allowLocalhostTls(apiBase);

    await expect(
      fetchJson(apiBase, "/system/health", {}, 401)
    ).resolves.toEqual(
      expect.objectContaining({
        message:
          "API key required. Provide 'Authorization: Bearer <api-key>' header.",
      })
    );
  });
});
