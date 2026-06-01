import { beforeEach, describe, expect, it, vi } from "vitest";

const createJwtMock = vi.fn();
const createTokenMock = vi.fn();
const getCommitMock = vi.fn();
const getTreeMock = vi.fn();
const getBindingMock = vi.fn();
const getWatchByIdMock = vi.fn();
const markDeliveryMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));

vi.mock("../inngest/client", () => ({
  inngest: {
    createFunction: (config: { onFailure?: unknown }, handler: unknown) => ({
      handler,
      onFailure: config.onFailure,
    }),
  },
}));

vi.mock("@db/app", () => ({
  getOrgBindingByProviderInstallation: getBindingMock,
  getWatchedSourceControlRepositoryById: getWatchByIdMock,
  markSourceControlWebhookDeliveryStatus: markDeliveryMock,
}));

vi.mock("@repo/github-app-node", () => ({
  createGitHubAppJwt: createJwtMock,
  createGitHubInstallationToken: createTokenMock,
  getGitHubCommit: getCommitMock,
  getGitHubTree: getTreeMock,
}));

vi.mock("../env", () => ({
  env: {
    GITHUB_API_VERSION: "2022-11-28",
    GITHUB_APP_ENDPOINT_ORIGIN: "https://github.lightfast.localhost",
    GITHUB_APP_ID: "424242",
    GITHUB_APP_PRIVATE_KEY: "private-key",
    GITHUB_APP_SLUG: "lightfast-local",
    GITHUB_APP_CLIENT_ID: "client",
    GITHUB_APP_CLIENT_SECRET: "secret",
    VERCEL_ENV: "development",
  },
}));

describe("source control repository sync workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("fetches GitHub repository state and marks the delivery processed", async () => {
    createJwtMock.mockResolvedValue("jwt");
    createTokenMock.mockResolvedValue({ token: "ghs_installation" });
    getCommitMock.mockResolvedValue({
      sha: "a".repeat(40),
      treeSha: "tree-sha",
    });
    getWatchByIdMock.mockResolvedValue({
      id: 9,
      orgSourceControlBindingId: 1,
      providerRepositoryId: "2002",
      watchedPathGlobs: ["skills/**"],
    });
    getBindingMock.mockResolvedValue({
      id: 1,
      providerInstallationId: "1001",
      status: "active",
    });
    getTreeMock.mockResolvedValue({
      sha: "tree-sha",
      tree: [
        {
          mode: "100644",
          path: "skills/demo/SKILL.md",
          sha: "blob-sha",
          type: "blob",
        },
        {
          mode: "100644",
          path: "docs/demo.md",
          sha: "docs-blob-sha",
          type: "blob",
        },
      ],
      truncated: false,
    });
    markDeliveryMock.mockResolvedValue(true);

    const { syncGitHubSourceControlRepository } = await import(
      "../inngest/workflow/sync-source-control-repository"
    );
    const workflow = syncGitHubSourceControlRepository as unknown as {
      handler: (input: unknown) => Promise<unknown>;
    };

    const result = await workflow.handler({
      event: {
        data: {
          afterSha: "a".repeat(40),
          beforeSha: "b".repeat(40),
          changedPaths: ["skills/demo/SKILL.md"],
          deliveryId: "delivery-1",
          orgSourceControlBindingId: 1,
          providerInstallationId: "1001",
          providerRepositoryId: "2002",
          ref: "refs/heads/main",
          repositoryFullName: "lightfast-emulated/workspace",
          repositoryWatchId: 9,
        },
      },
      step: {
        run: async (_name: string, fn: () => unknown) => await fn(),
      },
    } as never);

    expect(result).toEqual({ status: "processed" });
    expect(getTreeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        recursive: true,
        treeSha: "tree-sha",
      })
    );
    expect(markDeliveryMock).toHaveBeenCalledWith(
      {},
      {
        deliveryId: "delivery-1",
        status: "processed",
      }
    );
  });

  it("marks delivery ignored on missing watch before fetching GitHub repository state", async () => {
    getWatchByIdMock.mockResolvedValue(undefined);
    markDeliveryMock.mockResolvedValue(true);

    const { syncGitHubSourceControlRepository } = await import(
      "../inngest/workflow/sync-source-control-repository"
    );
    const workflow = syncGitHubSourceControlRepository as unknown as {
      handler: (input: unknown) => Promise<unknown>;
    };

    const result = await workflow.handler({
      event: {
        data: {
          afterSha: "a".repeat(40),
          beforeSha: "b".repeat(40),
          changedPaths: ["skills/demo/SKILL.md"],
          deliveryId: "delivery-2",
          orgSourceControlBindingId: 1,
          providerInstallationId: "1001",
          providerRepositoryId: "2002",
          ref: "refs/heads/main",
          repositoryFullName: "invalid-repository-name",
          repositoryWatchId: 10,
        },
      },
      step: {
        run: async (_name: string, fn: () => unknown) => await fn(),
      },
    } as never);

    expect(result).toEqual({ status: "missing-watch" });
    expect(createJwtMock).not.toHaveBeenCalled();
    expect(createTokenMock).not.toHaveBeenCalled();
    expect(getBindingMock).not.toHaveBeenCalled();
    expect(getCommitMock).not.toHaveBeenCalled();
    expect(getTreeMock).not.toHaveBeenCalled();
    expect(markDeliveryMock).toHaveBeenCalledWith(
      {},
      {
        deliveryId: "delivery-2",
        status: "ignored",
      }
    );
  });

  it("marks delivery ignored when the source control binding is no longer active", async () => {
    getWatchByIdMock.mockResolvedValue({
      id: 9,
      orgSourceControlBindingId: 1,
      providerRepositoryId: "2002",
      watchedPathGlobs: ["skills/**"],
    });
    getBindingMock.mockResolvedValue({
      id: 1,
      providerInstallationId: "1001",
      status: "revoked",
    });
    markDeliveryMock.mockResolvedValue(true);

    const { syncGitHubSourceControlRepository } = await import(
      "../inngest/workflow/sync-source-control-repository"
    );
    const workflow = syncGitHubSourceControlRepository as unknown as {
      handler: (input: unknown) => Promise<unknown>;
    };

    const result = await workflow.handler({
      event: {
        data: {
          afterSha: "a".repeat(40),
          beforeSha: "b".repeat(40),
          changedPaths: ["skills/demo/SKILL.md"],
          deliveryId: "delivery-binding-revoked",
          orgSourceControlBindingId: 1,
          providerInstallationId: "1001",
          providerRepositoryId: "2002",
          ref: "refs/heads/main",
          repositoryFullName: "lightfast-emulated/workspace",
          repositoryWatchId: 9,
        },
      },
      step: {
        run: async (_name: string, fn: () => unknown) => await fn(),
      },
    } as never);

    expect(result).toEqual({ status: "missing-binding" });
    expect(createJwtMock).not.toHaveBeenCalled();
    expect(createTokenMock).not.toHaveBeenCalled();
    expect(getCommitMock).not.toHaveBeenCalled();
    expect(getTreeMock).not.toHaveBeenCalled();
    expect(markDeliveryMock).toHaveBeenCalledWith(
      {},
      {
        deliveryId: "delivery-binding-revoked",
        status: "ignored",
      }
    );
  });

  it("marks delivery ignored when the watched repository no longer matches the event", async () => {
    getWatchByIdMock.mockResolvedValue({
      id: 9,
      orgSourceControlBindingId: 1,
      providerRepositoryId: "different-repo",
      watchedPathGlobs: ["skills/**"],
    });
    getBindingMock.mockResolvedValue({
      id: 1,
      providerInstallationId: "1001",
      status: "active",
    });
    markDeliveryMock.mockResolvedValue(true);

    const { syncGitHubSourceControlRepository } = await import(
      "../inngest/workflow/sync-source-control-repository"
    );
    const workflow = syncGitHubSourceControlRepository as unknown as {
      handler: (input: unknown) => Promise<unknown>;
    };

    const result = await workflow.handler({
      event: {
        data: {
          afterSha: "a".repeat(40),
          beforeSha: "b".repeat(40),
          changedPaths: ["skills/demo/SKILL.md"],
          deliveryId: "delivery-watch-mismatch",
          orgSourceControlBindingId: 1,
          providerInstallationId: "1001",
          providerRepositoryId: "2002",
          ref: "refs/heads/main",
          repositoryFullName: "lightfast-emulated/workspace",
          repositoryWatchId: 9,
        },
      },
      step: {
        run: async (_name: string, fn: () => unknown) => await fn(),
      },
    } as never);

    expect(result).toEqual({ status: "missing-watch" });
    expect(createJwtMock).not.toHaveBeenCalled();
    expect(createTokenMock).not.toHaveBeenCalled();
    expect(getCommitMock).not.toHaveBeenCalled();
    expect(getTreeMock).not.toHaveBeenCalled();
    expect(markDeliveryMock).toHaveBeenCalledWith(
      {},
      {
        deliveryId: "delivery-watch-mismatch",
        status: "ignored",
      }
    );
  });

  it("rejects truncated repository trees without marking the push processed", async () => {
    createJwtMock.mockResolvedValue("jwt");
    createTokenMock.mockResolvedValue({ token: "ghs_installation" });
    getCommitMock.mockResolvedValue({
      sha: "a".repeat(40),
      treeSha: "tree-sha",
    });
    getWatchByIdMock.mockResolvedValue({
      id: 9,
      orgSourceControlBindingId: 1,
      providerRepositoryId: "2002",
      watchedPathGlobs: ["skills/**"],
    });
    getBindingMock.mockResolvedValue({
      id: 1,
      providerInstallationId: "1001",
      status: "active",
    });
    getTreeMock.mockResolvedValue({
      sha: "tree-sha",
      tree: [
        {
          mode: "100644",
          path: "skills/demo/SKILL.md",
          sha: "blob-sha",
          type: "blob",
        },
      ],
      truncated: true,
    });

    const { syncGitHubSourceControlRepository } = await import(
      "../inngest/workflow/sync-source-control-repository"
    );
    const workflow = syncGitHubSourceControlRepository as unknown as {
      handler: (input: unknown) => Promise<unknown>;
    };

    await expect(
      workflow.handler({
        event: {
          data: {
            afterSha: "a".repeat(40),
            beforeSha: "b".repeat(40),
            changedPaths: ["skills/demo/SKILL.md"],
            deliveryId: "delivery-3",
            orgSourceControlBindingId: 1,
            providerInstallationId: "1001",
            providerRepositoryId: "2002",
            ref: "refs/heads/main",
            repositoryFullName: "lightfast-emulated/workspace",
            repositoryWatchId: 9,
          },
        },
        step: {
          run: async (_name: string, fn: () => unknown) => await fn(),
        },
      } as never)
    ).rejects.toThrow(/truncated/i);

    expect(markDeliveryMock).not.toHaveBeenCalled();
  });

  it("marks source control delivery failed from onFailure", async () => {
    markDeliveryMock.mockResolvedValue(true);

    const { syncGitHubSourceControlRepository } = await import(
      "../inngest/workflow/sync-source-control-repository"
    );
    const workflow = syncGitHubSourceControlRepository as unknown as {
      onFailure: (input: unknown) => Promise<unknown>;
    };

    const result = await workflow.onFailure({
      event: {
        data: {
          event: {
            data: {
              deliveryId: "delivery-4",
            },
          },
        },
      },
      step: {
        run: async (_name: string, fn: () => unknown) => await fn(),
      },
    } as never);

    expect(result).toEqual({ status: "failed" });
    expect(markDeliveryMock).toHaveBeenCalledWith(
      {},
      {
        deliveryId: "delivery-4",
        status: "failed",
      }
    );
  });

  it("rejects onFailure when the failed status cannot be written", async () => {
    markDeliveryMock.mockResolvedValue(false);

    const { syncGitHubSourceControlRepository } = await import(
      "../inngest/workflow/sync-source-control-repository"
    );
    const workflow = syncGitHubSourceControlRepository as unknown as {
      onFailure: (input: unknown) => Promise<unknown>;
    };

    await expect(
      workflow.onFailure({
        event: {
          data: {
            event: {
              data: {
                deliveryId: "delivery-5",
              },
            },
          },
        },
        step: {
          run: async (_name: string, fn: () => unknown) => await fn(),
        },
      } as never)
    ).rejects.toThrow(/delivery-5/);
  });
});
