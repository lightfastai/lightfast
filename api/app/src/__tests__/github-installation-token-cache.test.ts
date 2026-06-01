import { beforeEach, describe, expect, it, vi } from "vitest";

const createGitHubAppJwtMock = vi.fn();
const createGitHubInstallationTokenMock = vi.fn();

const envMock = {
  GITHUB_API_VERSION: "2022-11-28",
  GITHUB_APP_CLIENT_ID: "github_client_test",
  GITHUB_APP_CLIENT_SECRET: "github_secret_test",
  GITHUB_APP_ENDPOINT_ORIGIN: "https://github.lightfast.localhost",
  GITHUB_APP_ID: "12345",
  GITHUB_APP_PRIVATE_KEY: "test-private-key",
  GITHUB_APP_SLUG: "lightfast-test",
  VERCEL_ENV: "development" as const,
};

vi.mock("@repo/github-app-node", () => ({
  createGitHubAppJwt: createGitHubAppJwtMock,
  createGitHubInstallationToken: createGitHubInstallationTokenMock,
}));

vi.mock("../env", () => ({
  env: envMock,
}));

const {
  clearGitHubInstallationTokenCacheForTests,
  getCachedGitHubInstallationToken,
} = await import("../services/github/installation-token-cache");

beforeEach(() => {
  envMock.GITHUB_APP_ENDPOINT_ORIGIN = "https://github.lightfast.localhost";
  clearGitHubInstallationTokenCacheForTests();
  createGitHubAppJwtMock.mockReset();
  createGitHubInstallationTokenMock.mockReset();
  createGitHubAppJwtMock.mockResolvedValue("app.jwt");
  createGitHubInstallationTokenMock.mockResolvedValue({
    expiresAt: "2026-06-01T01:00:00.000Z",
    token: "ghs_installation",
  });
});

describe("GitHub installation token cache", () => {
  it("coalesces concurrent cache misses for one installation and app config", async () => {
    let resolveToken:
      | ((value: { expiresAt: string; token: string }) => void)
      | undefined;
    createGitHubInstallationTokenMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveToken = resolve;
      })
    );

    const first = getCachedGitHubInstallationToken({
      installationId: "1001",
      now: new Date("2026-06-01T00:00:00.000Z"),
    });
    const second = getCachedGitHubInstallationToken({
      installationId: "1001",
      now: new Date("2026-06-01T00:00:00.000Z"),
    });

    resolveToken?.({
      expiresAt: "2026-06-01T01:00:00.000Z",
      token: "ghs_installation",
    });

    await expect(Promise.all([first, second])).resolves.toEqual([
      "ghs_installation",
      "ghs_installation",
    ]);
    expect(createGitHubInstallationTokenMock).toHaveBeenCalledTimes(1);
  });

  it("keys tokens by app configuration as well as installation id", async () => {
    createGitHubInstallationTokenMock
      .mockResolvedValueOnce({
        expiresAt: "2026-06-01T01:00:00.000Z",
        token: "ghs_first_origin",
      })
      .mockResolvedValueOnce({
        expiresAt: "2026-06-01T01:00:00.000Z",
        token: "ghs_second_origin",
      });

    await expect(
      getCachedGitHubInstallationToken({
        installationId: "1001",
        now: new Date("2026-06-01T00:00:00.000Z"),
      })
    ).resolves.toBe("ghs_first_origin");

    envMock.GITHUB_APP_ENDPOINT_ORIGIN =
      "https://github-alt.lightfast.localhost";

    await expect(
      getCachedGitHubInstallationToken({
        installationId: "1001",
        now: new Date("2026-06-01T00:00:00.000Z"),
      })
    ).resolves.toBe("ghs_second_origin");

    expect(createGitHubInstallationTokenMock).toHaveBeenCalledTimes(2);
  });
});
