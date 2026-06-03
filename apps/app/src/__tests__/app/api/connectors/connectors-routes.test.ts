import { beforeEach, describe, expect, it, vi } from "vitest";

const completeLinearConnectorOAuthMock = vi.fn();

vi.mock("@api/app/services/connectors", () => ({
  completeLinearConnectorOAuth: completeLinearConnectorOAuthMock,
}));

describe("connector app route handlers", () => {
  beforeEach(() => {
    completeLinearConnectorOAuthMock.mockReset();
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
});
