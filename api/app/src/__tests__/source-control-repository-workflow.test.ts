import { describe, expect, it, vi } from "vitest";

const createJwtMock = vi.fn();
const createTokenMock = vi.fn();
const getCommitMock = vi.fn();
const getTreeMock = vi.fn();
const getWatchByIdMock = vi.fn();
const markDeliveryMock = vi.fn();
const updateProcessedMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));

vi.mock("../inngest/client", () => ({
  inngest: {
    createFunction: (_config: unknown, handler: unknown) => ({ handler }),
  },
}));

vi.mock("@db/app", () => ({
  getWatchedSourceControlRepositoryById: getWatchByIdMock,
  markSourceControlWebhookDeliveryStatus: markDeliveryMock,
  updateWatchedSourceControlRepositoryLastProcessedSha: updateProcessedMock,
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
      ],
      truncated: false,
    });
    updateProcessedMock.mockResolvedValue(true);
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
    expect(updateProcessedMock).toHaveBeenCalledWith(
      {},
      {
        id: 9,
        lastProcessedSha: "a".repeat(40),
      }
    );
    expect(markDeliveryMock).toHaveBeenCalledWith(
      {},
      {
        deliveryId: "delivery-1",
        status: "processed",
      }
    );
  });
});
