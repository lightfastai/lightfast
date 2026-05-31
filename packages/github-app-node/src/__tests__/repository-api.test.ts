import { describe, expect, it, vi } from "vitest";
import { createGitHubInstallationToken } from "../installation-tokens";
import {
  getGitHubCommit,
  getGitHubRepository,
  getGitHubTree,
} from "../repositories";
import { verifyGitHubInstallationRepository } from "../repository-installations";

describe("GitHub repository API helpers", () => {
  it("mints an installation token with app authentication", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json(
        {
          expires_at: "2026-05-30T10:00:00Z",
          token: "ghs_installation",
        },
        { status: 201 }
      )
    );

    await expect(
      createGitHubInstallationToken({
        apiBaseUrl: "https://github.lightfast.localhost",
        appJwt: "jwt",
        fetch: fetchMock,
        installationId: "1001",
      })
    ).resolves.toEqual({
      expiresAt: "2026-05-30T10:00:00Z",
      token: "ghs_installation",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://github.lightfast.localhost/app/installations/1001/access_tokens",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer jwt",
        }),
      })
    );
  });

  it("fetches commit and tree data with installation authentication", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          sha: "commit-sha",
          tree: { sha: "tree-sha" },
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          sha: "tree-sha",
          tree: [
            {
              mode: "100644",
              path: "skills/demo/SKILL.md",
              sha: "blob-sha",
              type: "blob",
            },
          ],
          truncated: false,
        })
      );

    await expect(
      getGitHubCommit({
        apiBaseUrl: "https://github.lightfast.localhost",
        fetch: fetchMock,
        installationToken: "ghs_installation",
        owner: "lightfast-emulated",
        ref: "commit-sha",
        repo: "workspace",
      })
    ).resolves.toEqual({ sha: "commit-sha", treeSha: "tree-sha" });

    await expect(
      getGitHubTree({
        apiBaseUrl: "https://github.lightfast.localhost",
        fetch: fetchMock,
        installationToken: "ghs_installation",
        owner: "lightfast-emulated",
        recursive: true,
        repo: "workspace",
        treeSha: "tree-sha",
      })
    ).resolves.toEqual({
      sha: "tree-sha",
      tree: [
        {
          mode: "100644",
          path: "skills/demo/SKILL.md",
          sha: "blob-sha",
          type: "blob",
        },
      ],
      truncated: false,
    });
  });

  it("fetches repository metadata with installation authentication", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        full_name: "lightfast-emulated/.lightfast",
        id: 987,
        name: ".lightfast",
        owner: { login: "lightfast-emulated" },
      })
    );

    await expect(
      getGitHubRepository({
        apiBaseUrl: "https://github.lightfast.localhost",
        fetch: fetchMock,
        installationToken: "ghs_installation",
        owner: "lightfast-emulated",
        repo: ".lightfast",
      })
    ).resolves.toEqual({
      fullName: "lightfast-emulated/.lightfast",
      id: "987",
      name: ".lightfast",
      owner: "lightfast-emulated",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://github.lightfast.localhost/repos/lightfast-emulated/.lightfast",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer ghs_installation",
        }),
      })
    );
  });

  it("URL-encodes refs used in commit API paths", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        sha: "commit-sha",
        tree: { sha: "tree-sha" },
      })
    );

    await getGitHubCommit({
      apiBaseUrl: "https://github.lightfast.localhost",
      fetch: fetchMock,
      installationToken: "ghs_installation",
      owner: "lightfast-emulated",
      ref: "feature/demo",
      repo: "workspace",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://github.lightfast.localhost/repos/lightfast-emulated/workspace/git/commits/feature%2Fdemo",
      expect.any(Object)
    );
  });

  it("accepts nested commit tree responses from local emulators", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        sha: "commit-sha",
        commit: { tree: { sha: "tree-sha" } },
      })
    );

    await expect(
      getGitHubCommit({
        apiBaseUrl: "https://github.lightfast.localhost",
        fetch: fetchMock,
        installationToken: "ghs_installation",
        owner: "lightfast-emulated",
        ref: "commit-sha",
        repo: "workspace",
      })
    ).resolves.toEqual({ sha: "commit-sha", treeSha: "tree-sha" });
  });

  it("accepts commit entries in tree responses", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        sha: "tree-sha",
        tree: [
          {
            mode: "160000",
            path: "vendor/submodule",
            sha: "submodule-sha",
            type: "commit",
          },
        ],
      })
    );

    await expect(
      getGitHubTree({
        apiBaseUrl: "https://github.lightfast.localhost",
        fetch: fetchMock,
        installationToken: "ghs_installation",
        owner: "lightfast-emulated",
        repo: "workspace",
        treeSha: "tree-sha",
      })
    ).resolves.toEqual({
      sha: "tree-sha",
      tree: [
        {
          mode: "160000",
          path: "vendor/submodule",
          sha: "submodule-sha",
          type: "commit",
        },
      ],
    });
  });

  it("verifies a repository belongs to the expected GitHub App installation", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        id: 1001,
        repository_selection: "all",
      })
    );

    await expect(
      verifyGitHubInstallationRepository({
        apiBaseUrl: "https://github.lightfast.localhost",
        appJwt: "app.jwt",
        expectedInstallationId: "1001",
        fetch: fetchMock,
        owner: "lightfast-emulated",
        repo: ".lightfast",
      })
    ).resolves.toEqual({
      installationId: "1001",
      repositorySelection: "all",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://github.lightfast.localhost/repos/lightfast-emulated/.lightfast/installation",
      expect.objectContaining({
        headers: expect.objectContaining({
          accept: "application/vnd.github+json",
          authorization: "Bearer app.jwt",
        }),
      })
    );
  });

  it("treats a missing repository installation as a typed not-found result", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ message: "Not Found" }, { status: 404 })
    );

    await expect(
      verifyGitHubInstallationRepository({
        apiBaseUrl: "https://github.lightfast.localhost",
        appJwt: "app.jwt",
        expectedInstallationId: "1001",
        fetch: fetchMock,
        owner: "lightfast-emulated",
        repo: ".lightfast",
      })
    ).rejects.toMatchObject({ code: "GITHUB_REPOSITORY_NOT_FOUND" });
  });

  it("rejects repositories attached to a different installation", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        id: 9999,
        repository_selection: "all",
      })
    );

    await expect(
      verifyGitHubInstallationRepository({
        apiBaseUrl: "https://github.lightfast.localhost",
        appJwt: "app.jwt",
        expectedInstallationId: "1001",
        fetch: fetchMock,
        owner: "lightfast-emulated",
        repo: ".lightfast",
      })
    ).rejects.toMatchObject({ code: "GITHUB_REPOSITORY_INACCESSIBLE" });
  });
});
