import { beforeEach, describe, expect, it, vi } from "vitest";

const completeLinearConnectorOAuthMock = vi.fn();
const completeXConnectorOAuthMock = vi.fn();
const completeGranolaUserConnectorOAuthMock = vi.fn();
const handleXConnectorMcpRequestMock = vi.fn();

vi.mock("@api/app/services/connectors", () => ({
  completeLinearConnectorOAuth: completeLinearConnectorOAuthMock,
  completeXConnectorOAuth: completeXConnectorOAuthMock,
  handleXConnectorMcpRequest: handleXConnectorMcpRequestMock,
}));

vi.mock("@api/app/services/user-connectors", () => ({
  completeGranolaUserConnectorOAuth: completeGranolaUserConnectorOAuthMock,
}));

describe("connector app route handlers", () => {
  beforeEach(() => {
    completeLinearConnectorOAuthMock.mockReset();
    completeXConnectorOAuthMock.mockReset();
    completeGranolaUserConnectorOAuthMock.mockReset();
    handleXConnectorMcpRequestMock.mockReset();
  });

  it("delegates Linear OAuth callbacks without deriving app origin in the route", async () => {
    completeLinearConnectorOAuthMock.mockResolvedValue({
      redirectUrl: "https://app.lightfast.localhost/acme/connectors",
    });
    const { GET } = await import(
      "~/app/(app)/(connectors)/api/connectors/linear/oauth/callback/route"
    );

    const res = await GET(
      new Request(
        "https://localhost:4293/api/connectors/linear/oauth/callback?code=abc&state=def"
      )
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "https://app.lightfast.localhost/acme/connectors"
    );
    expect(completeLinearConnectorOAuthMock).toHaveBeenCalledWith({
      requestUrl:
        "https://localhost:4293/api/connectors/linear/oauth/callback?code=abc&state=def",
    });
  });

  it("delegates X OAuth callbacks without deriving app origin in the route", async () => {
    completeXConnectorOAuthMock.mockResolvedValue({
      redirectUrl: "https://app.lightfast.localhost/acme/connectors",
    });
    const { GET } = await import(
      "~/app/(app)/(connectors)/api/connectors/x/oauth/callback/route"
    );

    const res = await GET(
      new Request(
        "https://localhost:4293/api/connectors/x/oauth/callback?code=abc&state=def"
      )
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "https://app.lightfast.localhost/acme/connectors"
    );
    expect(completeXConnectorOAuthMock).toHaveBeenCalledWith({
      requestUrl:
        "https://localhost:4293/api/connectors/x/oauth/callback?code=abc&state=def",
    });
  });

  it("delegates successful Granola user OAuth callbacks", async () => {
    completeGranolaUserConnectorOAuthMock.mockResolvedValue({
      redirectUrl:
        "https://app.lightfast.localhost/account/settings?connector=granola",
    });
    const { GET } = await import(
      "~/app/(app)/(connectors)/api/connectors/granola/oauth/callback/route"
    );

    const res = await GET(
      new Request(
        "https://localhost:4293/api/connectors/granola/oauth/callback?code=abc&state=def"
      )
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "https://app.lightfast.localhost/account/settings?connector=granola"
    );
    expect(completeGranolaUserConnectorOAuthMock).toHaveBeenCalledWith({
      code: "abc",
      requestUrl:
        "https://localhost:4293/api/connectors/granola/oauth/callback?code=abc&state=def",
      state: "def",
    });
  });

  it("redirects invalid Granola user OAuth callbacks to account settings", async () => {
    const { GET } = await import(
      "~/app/(app)/(connectors)/api/connectors/granola/oauth/callback/route"
    );

    const denied = await GET(
      new Request(
        "https://localhost:4293/api/connectors/granola/oauth/callback?error=access_denied&state=def"
      )
    );
    const missing = await GET(
      new Request(
        "https://localhost:4293/api/connectors/granola/oauth/callback?code=abc"
      )
    );

    expect(denied.headers.get("location")).toBe(
      "https://localhost:4293/account/settings?connector=granola&error=access_denied"
    );
    expect(missing.headers.get("location")).toBe(
      "https://localhost:4293/account/settings?connector=granola&error=missing_oauth_code"
    );
    expect(completeGranolaUserConnectorOAuthMock).not.toHaveBeenCalled();
  });

  it("delegates X MCP requests to route-level bearer auth", async () => {
    const bridgeResponse = new Response("ok", { status: 200 });
    handleXConnectorMcpRequestMock.mockResolvedValue(bridgeResponse);
    const { DELETE, GET, POST } = await import(
      "~/app/(app)/(connectors)/api/connectors/x/mcp/route"
    );
    const request = new Request("https://localhost:4293/api/connectors/x/mcp", {
      method: "POST",
    });

    await expect(GET(request)).resolves.toBe(bridgeResponse);
    await expect(POST(request)).resolves.toBe(bridgeResponse);
    await expect(DELETE(request)).resolves.toBe(bridgeResponse);
    expect(handleXConnectorMcpRequestMock).toHaveBeenCalledTimes(3);
    expect(handleXConnectorMcpRequestMock).toHaveBeenCalledWith({ request });
  });
});
