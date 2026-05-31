import { describe, expect, it } from "vitest";
import { parseGitHubUserAccountOAuthCallback } from "../services/github/user-account/callbacks";
import {
  accountTaskErrorRedirect,
  accountTaskUrl,
  missingUserAccountAttemptRedirect,
  userAccountCompleteUrl,
  userAccountSignInRedirect,
} from "../services/github/user-account/redirects";

describe("github user account callback and redirects", () => {
  it("parses user account OAuth callbacks", () => {
    expect(
      parseGitHubUserAccountOAuthCallback(
        "https://app.lightfast.localhost/api/github/user/oauth/callback?code=abc&state=def"
      )
    ).toEqual({ code: "abc", denied: null, state: "def" });
  });

  it("parses denied user account OAuth callbacks", () => {
    expect(
      parseGitHubUserAccountOAuthCallback(
        "https://app.lightfast.localhost/api/github/user/oauth/callback?error=access_denied&state=def"
      )
    ).toEqual({ code: null, denied: "access_denied", state: "def" });
  });

  it("builds account task redirects", () => {
    expect(
      accountTaskUrl({ appOrigin: "https://app.lightfast.localhost" })
    ).toBe("https://app.lightfast.localhost/account/tasks/github");
    expect(
      userAccountCompleteUrl({
        appOrigin: "https://app.lightfast.localhost",
        returnTo: "/account/tasks/github",
      })
    ).toBe(
      "https://app.lightfast.localhost/account/tasks/github/complete?return_to=%2Faccount%2Ftasks%2Fgithub"
    );
    expect(
      accountTaskErrorRedirect({
        appOrigin: "https://app.lightfast.localhost",
        code: "missing_refresh_token",
      }).redirectUrl
    ).toBe(
      "https://app.lightfast.localhost/account/tasks/github?github_error=missing_refresh_token"
    );
  });

  it("builds missing attempt redirects", () => {
    expect(
      missingUserAccountAttemptRedirect({
        appOrigin: "https://app.lightfast.localhost",
      }).redirectUrl
    ).toBe(
      "https://app.lightfast.localhost/account/tasks/github?github_error=expired_state"
    );
  });

  it("builds sign-in redirects with only the callback path and query", () => {
    expect(
      userAccountSignInRedirect({
        appOrigin: "https://app.lightfast.localhost",
        requestUrl:
          "https://evil.example/api/github/user/oauth/callback?code=abc&state=def",
      }).redirectUrl
    ).toBe(
      "https://app.lightfast.localhost/sign-in?redirect_url=%2Fapi%2Fgithub%2Fuser%2Foauth%2Fcallback%3Fcode%3Dabc%26state%3Ddef"
    );
  });
});
