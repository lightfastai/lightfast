import { beforeEach, describe, expect, it, vi } from "vitest";

const completeLinearConnectorOAuthMock = vi.fn();
const completeXConnectorOAuthMock = vi.fn();
const handleXConnectorMcpRequestMock = vi.fn();

vi.mock("@api/app/services/connectors", () => ({
  completeLinearConnectorOAuth: completeLinearConnectorOAuthMock,
  completeXConnectorOAuth: completeXConnectorOAuthMock,
  handleXConnectorMcpRequest: handleXConnectorMcpRequestMock,
}));

describe("connector app route handlers", () => {
  beforeEach(() => {
    completeLinearConnectorOAuthMock.mockReset();
    completeXConnectorOAuthMock.mockReset();
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
