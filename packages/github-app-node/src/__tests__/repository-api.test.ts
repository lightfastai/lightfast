import { describe, expect, it, vi } from "vitest";
import {
  GitHubAppNodeError,
  getGitHubBlobText,
  getGitHubReference,
  getGitHubTree as getGitHubTreeFromIndex,
} from "../index";
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

  it("passes abort signals to installation token requests", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(
      async (_url: RequestInfo | URL, init?: RequestInit) => {
        expect(init?.signal).toBe(controller.signal);
        throw new DOMException("This operation was aborted", "AbortError");
      }
    );

    const result = createGitHubInstallationToken({
      apiBaseUrl: "https://github.lightfast.localhost",
      appJwt: "jwt",
      fetch: fetchMock,
      installationId: "1001",
      signal: controller.signal,
    });

    await expect(result).rejects.toMatchObject({ name: "AbortError" });
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

describe("skill index GitHub repository helpers", () => {
  it("fetches a branch ref with response etag", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            object: { sha: "a".repeat(40), type: "commit" },
          }),
          {
            headers: { etag: '"ref-etag"' },
            status: 200,
          }
        )
    );

    await expect(
      getGitHubReference({
        apiBaseUrl: "https://api.github.test",
        apiVersion: "2022-11-28",
        fetch: fetchMock,
        installationToken: "token",
        owner: "acme",
        ref: "heads/main",
        repo: ".lightfast",
      })
    ).resolves.toEqual({
      etag: '"ref-etag"',
      sha: "a".repeat(40),
      status: "found",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.test/repos/acme/.lightfast/git/ref/heads/main",
      expect.any(Object)
    );
  });

  it("encodes nested ref segments separately", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            object: { sha: "a".repeat(40), type: "commit" },
          }),
          { status: 200 }
        )
    );

    await getGitHubReference({
      apiBaseUrl: "https://api.github.test",
      fetch: fetchMock,
      installationToken: "token",
      owner: "acme",
      ref: "heads/feature/demo branch",
      repo: ".lightfast",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.test/repos/acme/.lightfast/git/ref/heads/feature/demo%20branch",
      expect.any(Object)
    );
  });

  it("returns not-modified when GitHub returns 304", async () => {
    const fetchMock = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        new Response(null, { status: 304 })
    );

    await expect(
      getGitHubReference({
        apiBaseUrl: "https://api.github.test",
        etag: '"old"',
        fetch: fetchMock,
        installationToken: "token",
        owner: "acme",
        ref: "heads/main",
        repo: ".lightfast",
      })
    ).resolves.toEqual({ status: "not_modified" });
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      "if-none-match": '"old"',
    });
  });

  it("maps missing refs to GITHUB_REF_NOT_FOUND", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ message: "Not Found" }), { status: 404 })
    );

    const result = getGitHubReference({
      apiBaseUrl: "https://api.github.test",
      fetch: fetchMock,
      installationToken: "token",
      owner: "acme",
      ref: "heads/main",
      repo: ".lightfast",
    });

    await expect(result).rejects.toBeInstanceOf(GitHubAppNodeError);
    await expect(result).rejects.toMatchObject({
      code: "GITHUB_REF_NOT_FOUND",
    });
  });

  it("preserves optional tree entry size", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            sha: "tree",
            tree: [
              {
                mode: "100644",
                path: "skills/code-review/SKILL.md",
                sha: "blob",
                size: 123,
                type: "blob",
              },
            ],
          }),
          { status: 200 }
        )
    );

    const tree = await getGitHubTreeFromIndex({
      apiBaseUrl: "https://api.github.test",
      fetch: fetchMock,
      installationToken: "token",
      owner: "acme",
      recursive: true,
      repo: ".lightfast",
      treeSha: "tree",
    });

    expect(tree.tree[0]).toMatchObject({ size: 123 });
  });

  it("decodes GitHub blob content", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            content: Buffer.from("hello").toString("base64"),
            encoding: "base64",
            sha: "blob",
            size: 5,
          }),
          { status: 200 }
        )
    );

    await expect(
      getGitHubBlobText({
        apiBaseUrl: "https://api.github.test",
        fetch: fetchMock,
        installationToken: "token",
        owner: "acme",
        repo: ".lightfast",
        sha: "blob",
      })
    ).resolves.toEqual({ sha: "blob", size: 5, text: "hello" });
  });

  it("rejects malformed GitHub blob base64", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            content: "YR==",
            encoding: "base64",
            sha: "blob",
            size: 1,
          }),
          { status: 200 }
        )
    );

    await expect(
      getGitHubBlobText({
        apiBaseUrl: "https://api.github.test",
        fetch: fetchMock,
        installationToken: "token",
        owner: "acme",
        repo: ".lightfast",
        sha: "blob",
      })
    ).rejects.toMatchObject({ code: "GITHUB_BLOB_DECODE_FAILED" });
  });

  it("rejects GitHub blob content with invalid UTF-8", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            content: Buffer.from([0xff]).toString("base64"),
            encoding: "base64",
            sha: "blob",
            size: 1,
          }),
          { status: 200 }
        )
    );

    await expect(
      getGitHubBlobText({
        apiBaseUrl: "https://api.github.test",
        fetch: fetchMock,
        installationToken: "token",
        owner: "acme",
        repo: ".lightfast",
        sha: "blob",
      })
    ).rejects.toMatchObject({ code: "GITHUB_BLOB_DECODE_FAILED" });
  });

  it("URL-encodes blob SHAs used in GitHub blob API paths", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            content: Buffer.from("hello").toString("base64"),
            encoding: "base64",
            sha: "blob/sha value",
            size: 5,
          }),
          { status: 200 }
        )
    );

    await getGitHubBlobText({
      apiBaseUrl: "https://api.github.test",
      fetch: fetchMock,
      installationToken: "token",
      owner: "acme",
      repo: ".lightfast",
      sha: "blob/sha value",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.test/repos/acme/.lightfast/git/blobs/blob%2Fsha%20value",
      expect.any(Object)
    );
  });
});
