import { describe, expect, it, vi } from "vitest";
import { createGitHubInstallationToken } from "../installation-tokens";
import { getGitHubCommit, getGitHubTree } from "../repositories";

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
});
