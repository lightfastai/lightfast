import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const completeSetupMock = vi.fn();
const completeOAuthMock = vi.fn();

vi.mock("@api/app/github", () => ({
  completeGitHubInstallationSetup: completeSetupMock,
  completeGitHubOAuthVerification: completeOAuthMock,
}));

describe("GitHub app route handlers", () => {
  beforeEach(() => {
    completeSetupMock.mockReset();
    completeOAuthMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("redirects setup callback to the delegated setup result", async () => {
    completeSetupMock.mockResolvedValue({
      redirectUrl: "http://127.0.0.1:4567/login/oauth/authorize?state=abc",
    });
    const { GET } = await import(
      "~/app/(app)/(github)/api/github/setup/route"
    );

    const res = await GET(
      new Request(
        "https://app.lightfast.localhost/api/github/setup?installation_id=1001&state=abc"
      )
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://127.0.0.1:4567/login/oauth/authorize?state=abc"
    );
    expect(completeSetupMock).toHaveBeenCalledWith({
      appOrigin: "https://app.lightfast.localhost",
      requestUrl:
        "https://app.lightfast.localhost/api/github/setup?installation_id=1001&state=abc",
    });
  });

  it("redirects OAuth callback to the delegated OAuth result", async () => {
    completeOAuthMock.mockResolvedValue({
      redirectUrl:
        "https://app.lightfast.localhost/acme/tasks/bind/github/complete",
    });
    const { GET } = await import(
      "~/app/(app)/(github)/api/github/oauth/callback/route"
    );

    const res = await GET(
      new Request(
        "https://app.lightfast.localhost/api/github/oauth/callback?code=abc&state=def"
      )
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "https://app.lightfast.localhost/acme/tasks/bind/github/complete"
    );
    expect(completeOAuthMock).toHaveBeenCalledWith({
      appOrigin: "https://app.lightfast.localhost",
      requestUrl:
        "https://app.lightfast.localhost/api/github/oauth/callback?code=abc&state=def",
    });
  });

  it("rejects dev install shim requests in production", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv(
      "GITHUB_INSTALL_URL_OVERRIDE",
      "https://app.lightfast.localhost/api/dev/github/install"
    );
    const { GET } = await import(
      "~/app/(app)/(github)/api/dev/github/install/route"
    );

    const res = await GET(
      new Request(
        "https://app.lightfast.localhost/api/dev/github/install?installation_id=1001&state=abc"
      )
    );

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "Not Found" });
  });

  it("rejects dev install shim requests when the override is missing", async () => {
    vi.stubEnv("VERCEL_ENV", "development");
    const { GET } = await import(
      "~/app/(app)/(github)/api/dev/github/install/route"
    );

    const res = await GET(
      new Request(
        "https://app.lightfast.localhost/api/dev/github/install?installation_id=1001&state=abc"
      )
    );

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "Not Found" });
  });

  it.each([
    [
      "missing state",
      "https://app.lightfast.localhost/api/dev/github/install?installation_id=1001",
    ],
    [
      "missing installation id",
      "https://app.lightfast.localhost/api/dev/github/install?state=abc",
    ],
  ])("rejects dev install shim requests with %s", async (_name, requestUrl) => {
    vi.stubEnv("VERCEL_ENV", "development");
    vi.stubEnv(
      "GITHUB_INSTALL_URL_OVERRIDE",
      "https://app.lightfast.localhost/api/dev/github/install"
    );
    const { GET } = await import(
      "~/app/(app)/(github)/api/dev/github/install/route"
    );

    const res = await GET(new Request(requestUrl));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "Invalid GitHub install shim request",
    });
  });

  it("redirects dev install shim requests to the GitHub setup callback", async () => {
    vi.stubEnv("VERCEL_ENV", "development");
    vi.stubEnv(
      "GITHUB_INSTALL_URL_OVERRIDE",
      "https://app.lightfast.localhost/api/dev/github/install"
    );
    const { GET } = await import(
      "~/app/(app)/(github)/api/dev/github/install/route"
    );

    const res = await GET(
      new Request(
        "https://app.lightfast.localhost/api/dev/github/install?installation_id=1001&state=abc"
      )
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "https://app.lightfast.localhost/api/github/setup?installation_id=1001&setup_action=install&state=abc"
    );
  });
});
