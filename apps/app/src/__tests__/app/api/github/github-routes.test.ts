import { beforeEach, describe, expect, it, vi } from "vitest";

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

  it("delegates setup callbacks without deriving app origin in the route", async () => {
    completeSetupMock.mockResolvedValue({
      redirectUrl: "http://127.0.0.1:4567/login/oauth/authorize?state=abc",
    });
    const { GET } = await import("~/app/(app)/(github)/api/github/setup/route");

    const res = await GET(
      new Request(
        "https://localhost:4293/api/github/setup?installation_id=1001&state=abc"
      )
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://127.0.0.1:4567/login/oauth/authorize?state=abc"
    );
    expect(completeSetupMock).toHaveBeenCalledWith({
      requestUrl:
        "https://localhost:4293/api/github/setup?installation_id=1001&state=abc"
    });
  });

  it("delegates OAuth callbacks without deriving app origin in the route", async () => {
    completeOAuthMock.mockResolvedValue({
      redirectUrl:
        "https://app.lightfast.localhost/acme/tasks/bind/github/complete",
    });
    const { GET } = await import(
      "~/app/(app)/(github)/api/github/oauth/callback/route"
    );

    const res = await GET(
      new Request(
        "https://localhost:4293/api/github/oauth/callback?code=abc&state=def"
      )
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "https://app.lightfast.localhost/acme/tasks/bind/github/complete"
    );
    expect(completeOAuthMock).toHaveBeenCalledWith({
      requestUrl:
        "https://localhost:4293/api/github/oauth/callback?code=abc&state=def"
    });
  });
});
