import { describe, expect, it, vi } from "vitest";
import { getGitHubAuthenticatedUser, getGitHubUserByLogin } from "../user";

describe("getGitHubAuthenticatedUser", () => {
  it("returns the stable GitHub user id from GET /user", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        id: 12_345,
        login: "lightfast-dev",
        type: "User",
      })
    );

    await expect(
      getGitHubAuthenticatedUser({
        apiBaseUrl: "https://github.lightfast.localhost",
        apiVersion: "2022-11-28",
        fetch: fetchMock,
        userAccessToken: "ghu_access",
      })
    ).resolves.toEqual({
      id: "12345",
      login: "lightfast-dev",
      type: "User",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://github.lightfast.localhost/user",
      expect.objectContaining({
        headers: expect.objectContaining({
          accept: "application/vnd.github+json",
          authorization: "Bearer ghu_access",
          "x-github-api-version": "2022-11-28",
        }),
      })
    );
  });

  it("rejects non-user authenticated identities", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ id: 99, login: "acme", type: "Organization" })
    );

    await expect(
      getGitHubAuthenticatedUser({
        fetch: fetchMock,
        userAccessToken: "ghu_access",
      })
    ).rejects.toMatchObject({ code: "GITHUB_USER_NOT_VERIFIED" });
  });
});

describe("getGitHubUserByLogin", () => {
  it("returns a rich user profile from GET /users/{login}", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        bio: "Building agents.",
        blog: "https://acme.com",
        company: "Acme",
        email: null,
        id: 12_345,
        location: "San Francisco",
        login: "avachen",
        name: "Ava Chen",
        twitter_username: "ava_ai",
        type: "User",
      })
    );

    await expect(
      getGitHubUserByLogin({
        apiBaseUrl: "https://github.lightfast.localhost",
        apiVersion: "2022-11-28",
        fetch: fetchMock,
        login: "avachen",
        token: "installation_token",
      })
    ).resolves.toEqual({
      bio: "Building agents.",
      blog: "https://acme.com",
      company: "Acme",
      email: null,
      id: "12345",
      location: "San Francisco",
      login: "avachen",
      name: "Ava Chen",
      twitterUsername: "ava_ai",
      type: "User",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://github.lightfast.localhost/users/avachen",
      expect.objectContaining({
        headers: expect.objectContaining({
          accept: "application/vnd.github+json",
          authorization: "Bearer installation_token",
          "x-github-api-version": "2022-11-28",
        }),
      })
    );
  });
});
