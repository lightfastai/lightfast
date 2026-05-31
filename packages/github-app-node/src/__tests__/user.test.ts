import { afterEach, describe, expect, it, vi } from "vitest";
import { getGitHubAuthenticatedUser } from "../user";

describe("getGitHubAuthenticatedUser", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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

  it("aborts authenticated user verification when no caller signal is provided", async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn(
      async (
        _input: Parameters<typeof fetch>[0],
        init?: RequestInit
      ): Promise<Response> => {
        if (!(init?.signal instanceof AbortSignal)) {
          throw new Error("missing abort signal");
        }

        return new Promise<Response>((_, reject) => {
          init.signal?.addEventListener(
            "abort",
            () => reject(new Error("aborted")),
            { once: true }
          );
        });
      }
    );

    const result = getGitHubAuthenticatedUser({
      fetch: fetchMock,
      timeoutMs: 5,
      userAccessToken: "ghu_access",
    });
    const assertion = expect(result).rejects.toMatchObject({
      code: "GITHUB_USER_NOT_VERIFIED",
    });
    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(init?.signal).toBeInstanceOf(AbortSignal);

    await vi.advanceTimersByTimeAsync(5);

    await assertion;
    expect(init?.signal?.aborted).toBe(true);
  });
});
