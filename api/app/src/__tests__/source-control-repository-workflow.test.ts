import { beforeEach, describe, expect, it, vi } from "vitest";

const createJwtMock = vi.fn();
const createTokenMock = vi.fn();
const getCommitMock = vi.fn();
const getTreeMock = vi.fn();
const getWatchByIdMock = vi.fn();
const markDeliveryMock = vi.fn();
const markPushProcessedMock = vi.fn();

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
  getWatchedSourceControlRepositoryById: getWatchByIdMock,
  markSourceControlWebhookDeliveryStatus: markDeliveryMock,
  markWatchedSourceControlRepositoryPushProcessed: markPushProcessedMock,
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

  it("fetches repository state and updates cursors", async () => {
    createJwtMock.mockResolvedValue("jwt");
    createTokenMock.mockResolvedValue({ token: "ghs_installation" });
    getCommitMock.mockResolvedValue({
      sha: "a".repeat(40),
      treeSha: "tree-sha",
    });
    getWatchByIdMock.mockResolvedValue({
      id: 9,
      watchedPathGlobs: ["skills/**"],
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
    markPushProcessedMock.mockResolvedValue(undefined);
    markDeliveryMock.mockResolvedValue(true);

    const { syncSourceControlRepository } = await import(
      "../inngest/workflow/sync-source-control-repository"
    );
    const workflow = syncSourceControlRepository as unknown as {
      handler: (input: unknown) => Promise<unknown>;
    };

    const result = await workflow.handler({
      event: {
        data: {
          afterSha: "a".repeat(40),
          beforeSha: "b".repeat(40),
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

    expect(result).toEqual({
      matchedPathCount: 1,
      status: "processed",
    });
    expect(markPushProcessedMock).toHaveBeenCalledWith(
      {},
      {
        deliveryId: "delivery-1",
        lastProcessedSha: "a".repeat(40),
        repositoryWatchId: 9,
      }
    );
    expect(markDeliveryMock).not.toHaveBeenCalled();
  });

  it("marks delivery ignored on missing watch before fetching GitHub repository state", async () => {
    getWatchByIdMock.mockResolvedValue(undefined);
    markDeliveryMock.mockResolvedValue(true);

    const { syncSourceControlRepository } = await import(
      "../inngest/workflow/sync-source-control-repository"
    );
    const workflow = syncSourceControlRepository as unknown as {
      handler: (input: unknown) => Promise<unknown>;
    };

    const result = await workflow.handler({
      event: {
        data: {
          afterSha: "a".repeat(40),
          beforeSha: "b".repeat(40),
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
    expect(getCommitMock).not.toHaveBeenCalled();
    expect(getTreeMock).not.toHaveBeenCalled();
    expect(markPushProcessedMock).not.toHaveBeenCalled();
    expect(markDeliveryMock).toHaveBeenCalledWith(
      {},
      {
        deliveryId: "delivery-2",
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
      watchedPathGlobs: ["skills/**"],
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

    const { syncSourceControlRepository } = await import(
      "../inngest/workflow/sync-source-control-repository"
    );
    const workflow = syncSourceControlRepository as unknown as {
      handler: (input: unknown) => Promise<unknown>;
    };

    await expect(
      workflow.handler({
        event: {
          data: {
            afterSha: "a".repeat(40),
            beforeSha: "b".repeat(40),
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

    expect(markPushProcessedMock).not.toHaveBeenCalled();
    expect(markDeliveryMock).not.toHaveBeenCalled();
  });

  it("marks source control delivery failed from onFailure", async () => {
    markDeliveryMock.mockResolvedValue(true);

    const { syncSourceControlRepository } = await import(
      "../inngest/workflow/sync-source-control-repository"
    );
    const workflow = syncSourceControlRepository as unknown as {
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

    const { syncSourceControlRepository } = await import(
      "../inngest/workflow/sync-source-control-repository"
    );
    const workflow = syncSourceControlRepository as unknown as {
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
