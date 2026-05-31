import { beforeEach, describe, expect, it, vi } from "vitest";

const completeSetupMock = vi.fn();
const completeOAuthMock = vi.fn();
const completeUserAccountOAuthMock = vi.fn();
const handleWebhookMock = vi.fn();

vi.mock("@api/app/services/github", () => ({
  completeGitHubInstallationSetup: completeSetupMock,
  completeGitHubOAuthVerification: completeOAuthMock,
  completeGitHubUserAccountOAuth: completeUserAccountOAuthMock,
  handleGitHubWebhook: handleWebhookMock,
}));

describe("GitHub app route handlers", () => {
  beforeEach(() => {
    completeSetupMock.mockReset();
    completeOAuthMock.mockReset();
    completeUserAccountOAuthMock.mockReset();
    handleWebhookMock.mockReset();
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
        "https://localhost:4293/api/github/setup?installation_id=1001&state=abc",
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
        "https://localhost:4293/api/github/oauth/callback?code=abc&state=def",
    });
  });

  it("delegates user account OAuth callbacks without deriving app origin in the route", async () => {
    completeUserAccountOAuthMock.mockResolvedValue({
      redirectUrl:
        "https://app.lightfast.localhost/account/tasks/github/complete",
    });
    const { GET } = await import(
      "~/app/(app)/(github)/api/github/user/oauth/callback/route"
    );

    const res = await GET(
      new Request(
        "https://localhost:4293/api/github/user/oauth/callback?code=abc&state=def"
      )
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "https://app.lightfast.localhost/account/tasks/github/complete"
    );
    expect(completeUserAccountOAuthMock).toHaveBeenCalledWith({
      requestUrl:
        "https://localhost:4293/api/github/user/oauth/callback?code=abc&state=def",
    });
  });

  it("delegates GitHub webhooks without reading the body in the route", async () => {
    handleWebhookMock.mockResolvedValue(
      Response.json({ ok: true }, { status: 202 })
    );
    const { POST } = await import(
      "~/app/(app)/(github)/api/github/webhook/route"
    );
    const req = new Request("https://localhost:4293/api/github/webhook", {
      body: JSON.stringify({ zen: "Keep it logically awesome." }),
      method: "POST",
    });

    const res = await POST(req);

    expect(res.status).toBe(202);
    expect(handleWebhookMock).toHaveBeenCalledWith({ request: req });
  });
});
