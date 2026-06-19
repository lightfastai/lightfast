import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const completeGranolaUserConnectorOAuthMock = vi.fn();

vi.mock("@vendor/clerk/server", () => ({
  auth: authMock,
}));

vi.mock("../services/connectors", () => ({
  completeLinearConnectorOAuth: vi.fn(),
  completeXConnectorOAuth: vi.fn(),
}));

vi.mock("../services/user-connectors", () => ({
  completeGranolaUserConnectorOAuth: completeGranolaUserConnectorOAuthMock,
}));

const { handleGranolaUserConnectorOAuthCallbackRequest } = await import(
  "../adapters/internal/connector-oauth"
);

describe("connector OAuth internal adapter", () => {
  beforeEach(() => {
    authMock.mockReset();
    authMock.mockResolvedValue({ userId: "user_current" });
    completeGranolaUserConnectorOAuthMock.mockReset();
    completeGranolaUserConnectorOAuthMock.mockResolvedValue({
      redirectUrl: "https://app.lightfast.localhost/account/settings",
    });
  });

  it("resolves the Clerk callback user before completing Granola OAuth", async () => {
    const request = new Request(
      "https://app.lightfast.localhost/api/connectors/granola/oauth/callback?code=oauth_code&state=provider_state"
    );

    const response =
      await handleGranolaUserConnectorOAuthCallbackRequest(request);

    expect(authMock).toHaveBeenCalledWith({ treatPendingAsSignedOut: false });
    expect(completeGranolaUserConnectorOAuthMock).toHaveBeenCalledWith({
      callbackUserId: "user_current",
      code: "oauth_code",
      requestUrl: request.url,
      state: "provider_state",
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://app.lightfast.localhost/account/settings"
    );
  });

  it("does not resolve auth when the callback is missing OAuth parameters", async () => {
    const response = await handleGranolaUserConnectorOAuthCallbackRequest(
      new Request(
        "https://app.lightfast.localhost/api/connectors/granola/oauth/callback?state=provider_state"
      )
    );

    expect(authMock).not.toHaveBeenCalled();
    expect(completeGranolaUserConnectorOAuthMock).not.toHaveBeenCalled();
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://app.lightfast.localhost/account/settings?connector=granola&error=missing_oauth_code"
    );
  });
});
