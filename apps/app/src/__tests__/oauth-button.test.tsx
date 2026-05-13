import { fireEvent, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";

const mockInitiate = vi.fn();

beforeEach(() => {
  vi.resetModules();
  mockInitiate.mockReset();
  vi.doMock("~/app/(auth)/_hooks/use-auth-flow", () => ({
    useAuthFlow: () => ({ oauth: { initiate: mockInitiate, loading: false } }),
  }));
});

afterEach(() => {
  vi.doUnmock("~/app/(auth)/_hooks/use-auth-flow");
});

describe("OAuthButton — strategy forwarding", () => {
  it("forwards the GitHub strategy", async () => {
    const { OAuthButton } = await import(
      "~/app/(auth)/_components/oauth-button"
    );
    render(
      <OAuthButton
        label="Continue with GitHub"
        mode="sign-in"
        strategy="oauth_github"
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: /continue with github/i })
    );
    expect(mockInitiate as Mock).toHaveBeenCalledWith("oauth_github");
  });

  it("forwards a custom strategy", async () => {
    const { OAuthButton } = await import(
      "~/app/(auth)/_components/oauth-button"
    );
    render(
      <OAuthButton
        label="Continue with Test IdP"
        mode="sign-in"
        strategy="oauth_custom_test_idp"
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: /continue with test idp/i })
    );
    expect(mockInitiate as Mock).toHaveBeenCalledWith("oauth_custom_test_idp");
  });

  it("renders the provided label verbatim", async () => {
    const { OAuthButton } = await import(
      "~/app/(auth)/_components/oauth-button"
    );
    render(
      <OAuthButton
        label="Continue with Test IdP"
        mode="sign-up"
        strategy="oauth_custom_test_idp"
      />
    );
    expect(
      screen.getByRole("button", { name: /continue with test idp/i })
    ).toBeInTheDocument();
  });
});
