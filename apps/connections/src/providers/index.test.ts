import { describe, it, expect, vi } from "vitest";

vi.mock("../env", () => ({
  env: {
    GATEWAY_API_KEY: "test-api-key",
    ENCRYPTION_KEY: "a".repeat(64),
    GITHUB_APP_SLUG: "test-app",
    GITHUB_APP_ID: "12345",
    GITHUB_CLIENT_ID: "gh-client-id",
    GITHUB_CLIENT_SECRET: "gh-client-secret",
    GITHUB_PRIVATE_KEY: "test-key",
    VERCEL_CLIENT_SECRET_ID: "vc-client-id",
    VERCEL_CLIENT_INTEGRATION_SECRET: "vc-secret",
    VERCEL_INTEGRATION_SLUG: "test-integration",
    LINEAR_CLIENT_ID: "lin-client-id",
    LINEAR_CLIENT_SECRET: "lin-secret",
    SENTRY_CLIENT_ID: "sn-client-id",
    SENTRY_CLIENT_SECRET: "sn-secret",
  },
}));

vi.mock("@db/console/client", () => ({
  db: {},
}));

vi.mock("@db/console/schema", () => ({
  gwInstallations: {},
  gwTokens: {},
}));

vi.mock("../lib/urls", () => ({
  connectionsBaseUrl: "https://connections.test",
  gatewayBaseUrl: "https://gateway.test",
  notifyBackfillService: vi.fn(),
}));

vi.mock("../lib/github-jwt", () => ({
  getInstallationToken: vi.fn(),
}));

vi.mock("../lib/crypto", () => ({
  decrypt: vi.fn(),
}));

vi.mock("../lib/token-store", () => ({
  writeTokenRecord: vi.fn(),
  updateTokenRecord: vi.fn(),
}));

import {
  getProvider,
  GitHubProvider,
  VercelProvider,
  LinearProvider,
  SentryProvider,
} from "./index";

describe("getProvider", () => {
  it("returns GitHubProvider for 'github'", () => {
    expect(getProvider("github")).toBeInstanceOf(GitHubProvider);
  });

  it("returns VercelProvider for 'vercel'", () => {
    expect(getProvider("vercel")).toBeInstanceOf(VercelProvider);
  });

  it("returns LinearProvider for 'linear'", () => {
    expect(getProvider("linear")).toBeInstanceOf(LinearProvider);
  });

  it("returns SentryProvider for 'sentry'", () => {
    expect(getProvider("sentry")).toBeInstanceOf(SentryProvider);
  });

  it("throws for unknown provider", () => {
    expect(() => getProvider("unknown")).toThrow();
  });
});
