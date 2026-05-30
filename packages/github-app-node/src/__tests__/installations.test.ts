import { describe, expect, it, vi } from "vitest";
import {
  listGitHubUserAccessibleInstallations,
  verifyGitHubUserInstallation,
} from "../installations";

function pageNumberFor(url: Parameters<typeof fetch>[0]): string | null {
  return new URL(url instanceof Request ? url.url : url).searchParams.get(
    "page"
  );
}

describe("GitHub user-accessible installation verification", () => {
  it("lists and normalizes user-accessible installations", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        total_count: 1,
        installations: [
          {
            id: 1001,
            account: {
              id: 20,
              login: "lightfast-emulated",
              type: "Organization",
            },
            app_id: 424_242,
            app_slug: "lightfast-local",
            events: ["issues"],
            permissions: { contents: "read" },
            repository_selection: "all",
            suspended_at: null,
            target_type: "Organization",
          },
        ],
      })
    );

    await expect(
      listGitHubUserAccessibleInstallations({
        apiBaseUrl: "https://github.lightfast.localhost",
        fetch: fetchMock,
        userAccessToken: "gho_test",
      })
    ).resolves.toEqual([
      expect.objectContaining({
        account: expect.objectContaining({
          login: "lightfast-emulated",
          type: "Organization",
        }),
        id: "1001",
        targetType: "Organization",
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://github.lightfast.localhost/user/installations?per_page=100&page=1",
      expect.objectContaining({
        headers: expect.objectContaining({
          accept: "application/vnd.github+json",
          authorization: "Bearer gho_test",
        }),
      })
    );
  });

  it("sends the configured GitHub API version header", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ total_count: 0, installations: [] })
    );

    await listGitHubUserAccessibleInstallations({
      apiBaseUrl: "https://github.lightfast.localhost",
      apiVersion: "2022-11-28",
      fetch: fetchMock,
      userAccessToken: "gho_test",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://github.lightfast.localhost/user/installations?per_page=100&page=1",
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-github-api-version": "2022-11-28",
        }),
      })
    );
  });

  it("clamps perPage to GitHub's supported range", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ total_count: 0, installations: [] })
    );

    await listGitHubUserAccessibleInstallations({
      apiBaseUrl: "https://github.lightfast.localhost",
      fetch: fetchMock,
      perPage: 0,
      userAccessToken: "gho_test",
    });

    await listGitHubUserAccessibleInstallations({
      apiBaseUrl: "https://github.lightfast.localhost",
      fetch: fetchMock,
      perPage: 250,
      userAccessToken: "gho_test",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://github.lightfast.localhost/user/installations?per_page=1&page=1",
      expect.any(Object)
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://github.lightfast.localhost/user/installations?per_page=100&page=1",
      expect.any(Object)
    );
  });

  it("finds an expected installation on a later page", async () => {
    const fetchMock = vi.fn(async (url: Parameters<typeof fetch>[0]) => {
      if (pageNumberFor(url) === "1") {
        return Response.json({
          total_count: 2,
          installations: [
            {
              id: 9999,
              account: { id: 10, login: "other-org", type: "Organization" },
              app_id: 424_242,
              app_slug: "lightfast-local",
              target_type: "Organization",
            },
          ],
        });
      }
      return Response.json({
        total_count: 2,
        installations: [
          {
            id: 1001,
            account: {
              id: 20,
              login: "lightfast-emulated",
              type: "Organization",
            },
            app_id: 424_242,
            app_slug: "lightfast-local",
            events: ["push"],
            permissions: { contents: "read" },
            repository_selection: "all",
            target_type: "Organization",
          },
        ],
      });
    });

    await expect(
      verifyGitHubUserInstallation({
        apiBaseUrl: "https://github.lightfast.localhost",
        expectedInstallationId: "1001",
        fetch: fetchMock,
        perPage: 1,
        userAccessToken: "gho_test",
      })
    ).resolves.toMatchObject({
      account: { login: "lightfast-emulated", type: "Organization" },
      id: "1001",
    });
  });

  it("continues listing to page 2 when a full page omits total_count", async () => {
    const fetchMock = vi.fn(async (url: Parameters<typeof fetch>[0]) => {
      if (pageNumberFor(url) === "1") {
        return Response.json({
          installations: [
            {
              id: 1001,
              account: { id: 10, login: "first-org", type: "Organization" },
              app_id: 424_242,
              app_slug: "lightfast-local",
              target_type: "Organization",
            },
            {
              id: 1002,
              account: { id: 20, login: "second-org", type: "Organization" },
              app_id: 424_242,
              app_slug: "lightfast-local",
              target_type: "Organization",
            },
          ],
        });
      }

      return Response.json({
        installations: [
          {
            id: 1003,
            account: { id: 30, login: "third-org", type: "Organization" },
            app_id: 424_242,
            app_slug: "lightfast-local",
            target_type: "Organization",
          },
        ],
      });
    });

    await expect(
      listGitHubUserAccessibleInstallations({
        apiBaseUrl: "https://github.lightfast.localhost",
        fetch: fetchMock,
        perPage: 2,
        userAccessToken: "gho_test",
      })
    ).resolves.toEqual([
      expect.objectContaining({ id: "1001" }),
      expect.objectContaining({ id: "1002" }),
      expect.objectContaining({ id: "1003" }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("finds an expected installation on page 2 when responses omit total_count", async () => {
    const fetchMock = vi.fn(async (url: Parameters<typeof fetch>[0]) => {
      if (pageNumberFor(url) === "1") {
        return Response.json({
          installations: [
            {
              id: 9999,
              account: { id: 10, login: "other-org", type: "Organization" },
              app_id: 424_242,
              app_slug: "lightfast-local",
              target_type: "Organization",
            },
          ],
        });
      }

      return Response.json({
        installations: [
          {
            id: 1001,
            account: {
              id: 20,
              login: "lightfast-emulated",
              type: "Organization",
            },
            app_id: 424_242,
            app_slug: "lightfast-local",
            target_type: "Organization",
          },
        ],
      });
    });

    await expect(
      verifyGitHubUserInstallation({
        apiBaseUrl: "https://github.lightfast.localhost",
        expectedInstallationId: "1001",
        fetch: fetchMock,
        perPage: 1,
        userAccessToken: "gho_test",
      })
    ).resolves.toMatchObject({
      account: { login: "lightfast-emulated", type: "Organization" },
      id: "1001",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns as soon as the expected installation is found", async () => {
    const fetchMock = vi.fn(async (url: Parameters<typeof fetch>[0]) => {
      if (pageNumberFor(url) === "1") {
        return Response.json({
          total_count: 2,
          installations: [
            {
              id: 1001,
              account: {
                id: 20,
                login: "lightfast-emulated",
                type: "Organization",
              },
              app_id: 424_242,
              app_slug: "lightfast-local",
              target_type: "Organization",
            },
          ],
        });
      }

      throw new Error("Verifier should not request page 2");
    });

    await expect(
      verifyGitHubUserInstallation({
        apiBaseUrl: "https://github.lightfast.localhost",
        expectedInstallationId: "1001",
        fetch: fetchMock,
        perPage: 1,
        userAccessToken: "gho_test",
      })
    ).resolves.toMatchObject({
      account: { login: "lightfast-emulated", type: "Organization" },
      id: "1001",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects missing installations with a typed verification error", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ total_count: 0, installations: [] })
    );

    await expect(
      verifyGitHubUserInstallation({
        apiBaseUrl: "https://github.lightfast.localhost",
        expectedInstallationId: "1001",
        fetch: fetchMock,
        userAccessToken: "gho_test",
      })
    ).rejects.toMatchObject({ code: "INSTALLATION_NOT_VERIFIED" });
  });

  it("rejects personal account installations with a typed unsupported-account error", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        total_count: 1,
        installations: [
          {
            id: 1001,
            account: { id: 10, login: "lightfast-dev", type: "User" },
            app_id: 424_242,
            app_slug: "lightfast-local",
            target_type: "User",
          },
        ],
      })
    );

    await expect(
      verifyGitHubUserInstallation({
        apiBaseUrl: "https://github.lightfast.localhost",
        expectedInstallationId: "1001",
        fetch: fetchMock,
        userAccessToken: "gho_test",
      })
    ).rejects.toMatchObject({ code: "PERSONAL_ACCOUNT_NOT_SUPPORTED" });
  });

  it("wraps invalid responses in a typed verification error", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ installations: [{ id: 1001, account: null }] })
    );

    await expect(
      listGitHubUserAccessibleInstallations({
        apiBaseUrl: "https://github.lightfast.localhost",
        fetch: fetchMock,
        userAccessToken: "gho_test",
      })
    ).rejects.toMatchObject({ code: "INSTALLATION_NOT_VERIFIED" });
  });

  it("wraps transport failures in a typed verification error", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("network unavailable");
    });

    await expect(
      verifyGitHubUserInstallation({
        apiBaseUrl: "https://github.lightfast.localhost",
        expectedInstallationId: "1001",
        fetch: fetchMock,
        userAccessToken: "gho_test",
      })
    ).rejects.toMatchObject({ code: "INSTALLATION_NOT_VERIFIED" });
  });
});
