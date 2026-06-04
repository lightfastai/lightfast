import type { OrgConnectorConnection } from "@db/app";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@db/app", () => ({
  getCurrentOrgConnectorConnection: vi.fn(),
  updateObservedConnectorTokens: vi.fn(),
}));

vi.mock("@repo/app-encryption", () => ({
  decrypt: vi.fn(),
  encrypt: vi.fn(),
}));

const { defaultLinearProviderRoutineAdapter } = await import("../linear");

const now = new Date("2026-06-04T00:00:00.000Z");

function connection(): OrgConnectorConnection {
  return {
    accessTokenExpiresAt: new Date("2099-06-04T00:00:00.000Z"),
    clerkOrgId: "org_acme",
    encryptedAccessToken: "encrypted_access",
    encryptedRefreshToken: "encrypted_refresh",
    id: 1,
    mcpEndpoint: "https://mcp.linear.app/mcp",
    provider: "linear",
    refreshTokenExpiresAt: new Date("2099-06-04T00:00:00.000Z"),
    status: "active",
  } as OrgConnectorConnection;
}

describe("defaultLinearProviderRoutineAdapter", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects incomplete ambient Linear env before reading token material", async () => {
    vi.stubEnv("ENCRYPTION_KEY", "0".repeat(64));
    vi.stubEnv("LINEAR_CLIENT_ID", "");
    vi.stubEnv("LINEAR_CLIENT_SECRET", "linear_secret_test");

    await expect(
      defaultLinearProviderRoutineAdapter.getAccessToken({
        connection: connection(),
        db: {} as never,
        log: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
        now: () => now,
      })
    ).rejects.toMatchObject({
      code: "LINEAR_TOKEN_REFRESH_FAILED",
      message: "Linear connector environment is incomplete.",
    });
  });
});
