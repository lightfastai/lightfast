import type { SourceControlRepository } from "@db/app/schema";
import {
  type GitHubInstallationRepository,
  listGitHubInstallationRepositories,
} from "@repo/github-app-node";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSourceControlRepositoryResponse,
  countNormalImportedRepositories,
  lightfastRepositoryIdFromBinding,
  listAllGitHubInstallationRepositories,
} from "./repositories";

vi.mock("@repo/github-app-node", () => ({
  listGitHubInstallationRepositories: vi.fn(),
}));

const binding = {
  id: 7,
  metadata: {
    lightfastRepository: {
      fullName: "acme/.lightfast",
      id: "100",
      installationId: "1001",
      name: ".lightfast",
      verifiedAt: "2026-05-31T00:00:00.000Z",
    },
  },
  providerAccountId: "20",
};

const listGitHubInstallationRepositoriesMock = vi.mocked(
  listGitHubInstallationRepositories
);

function liveRepository(
  overrides: Partial<GitHubInstallationRepository> = {}
): GitHubInstallationRepository {
  return {
    fullName: "acme/workspace",
    id: "200",
    name: "workspace",
    ownerId: "20",
    ownerLogin: "acme",
    private: true,
    ...overrides,
  };
}

function watchedRepository(
  overrides: Partial<SourceControlRepository> = {}
): SourceControlRepository {
  return {
    id: 10,
    orgSourceControlBindingId: 7,
    providerRepositoryId: "200",
    fullName: "old/workspace",
    watchedPathGlobs: ["**"],
    createdAt: new Date("2026-05-31T00:00:00.000Z"),
    updatedAt: new Date("2026-05-31T00:00:00.000Z"),
    ...overrides,
  };
}

describe("GitHub source-control repository service", () => {
  beforeEach(() => {
    listGitHubInstallationRepositoriesMock.mockReset();
  });

  it("extracts .lightfast setup repository id from binding metadata", () => {
    expect(lightfastRepositoryIdFromBinding(binding)).toBe("100");
  });

  it("merges live GitHub repositories with watched rows and excludes .lightfast", () => {
    expect(
      buildSourceControlRepositoryResponse({
        binding,
        liveRepositories: [
          {
            fullName: "acme/.lightfast",
            id: "100",
            name: ".lightfast",
            ownerId: "20",
            ownerLogin: "acme",
            private: true,
          },
          {
            fullName: "acme/workspace",
            id: "200",
            name: "workspace",
            ownerId: "20",
            ownerLogin: "acme",
            private: true,
          },
          {
            fullName: "other/repo",
            id: "300",
            name: "repo",
            ownerId: "30",
            ownerLogin: "other",
            private: false,
          },
        ],
        watchedRepositories: [
          {
            id: 10,
            orgSourceControlBindingId: 7,
            providerRepositoryId: "200",
            fullName: "old/workspace",
            watchedPathGlobs: ["**"],
            createdAt: new Date("2026-05-31T00:00:00.000Z"),
            updatedAt: new Date("2026-05-31T00:00:00.000Z"),
          },
          {
            id: 11,
            orgSourceControlBindingId: 7,
            providerRepositoryId: "999",
            fullName: "old/missing",
            watchedPathGlobs: ["**"],
            createdAt: new Date("2026-05-31T00:00:00.000Z"),
            updatedAt: new Date("2026-05-31T00:00:00.000Z"),
          },
        ],
      })
    ).toEqual([
      {
        fullName: "acme/workspace",
        id: "200",
        imported: true,
        name: "workspace",
        owner: { id: "20", login: "acme" },
        private: true,
        watchedPathGlobs: ["**"],
      },
    ]);
  });

  it("falls back to live .lightfast name exclusion when setup proof is absent", () => {
    const rows = buildSourceControlRepositoryResponse({
      binding: { id: 7, metadata: {}, providerAccountId: "20" },
      liveRepositories: [
        {
          fullName: "acme/.lightfast",
          id: "100",
          name: ".lightfast",
          ownerId: "20",
          ownerLogin: "acme",
          private: true,
        },
      ],
      watchedRepositories: [],
    });

    expect(rows).toEqual([]);
  });

  it("counts durable watched repositories while excluding the .lightfast proof repository", () => {
    expect(
      countNormalImportedRepositories({
        binding,
        watchedRepositories: [
          watchedRepository({
            id: 10,
            providerRepositoryId: "100",
            fullName: "acme/.lightfast",
          }),
          watchedRepository({
            id: 11,
            providerRepositoryId: "200",
            fullName: "old/workspace",
          }),
          watchedRepository({
            id: 12,
            providerRepositoryId: "999",
            fullName: "old/missing",
          }),
        ],
      })
    ).toBe(2);
  });

  it("lists GitHub installation repositories from page one with forwarded API options", async () => {
    listGitHubInstallationRepositoriesMock.mockResolvedValueOnce({
      repositories: [liveRepository()],
    });

    await expect(
      listAllGitHubInstallationRepositories({
        apiBaseUrl: "https://github.example.test",
        apiVersion: "2022-11-28",
        installationToken: "installation-token",
      })
    ).resolves.toEqual([liveRepository()]);

    expect(listGitHubInstallationRepositoriesMock).toHaveBeenCalledTimes(1);
    expect(listGitHubInstallationRepositoriesMock).toHaveBeenCalledWith({
      apiBaseUrl: "https://github.example.test",
      apiVersion: "2022-11-28",
      installationToken: "installation-token",
      page: 1,
      perPage: 100,
    });
  });

  it("increments GitHub repository pages and accumulates all repositories", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) =>
      liveRepository({
        fullName: `acme/repo-${index}`,
        id: String(200 + index),
        name: `repo-${index}`,
      })
    );
    const secondPage = [
      liveRepository({
        fullName: "acme/final",
        id: "999",
        name: "final",
      }),
    ];
    listGitHubInstallationRepositoriesMock
      .mockResolvedValueOnce({ repositories: firstPage })
      .mockResolvedValueOnce({ repositories: secondPage });

    await expect(
      listAllGitHubInstallationRepositories({
        installationToken: "installation-token",
      })
    ).resolves.toEqual([...firstPage, ...secondPage]);

    expect(listGitHubInstallationRepositoriesMock).toHaveBeenCalledTimes(2);
    expect(listGitHubInstallationRepositoriesMock).toHaveBeenNthCalledWith(1, {
      apiBaseUrl: undefined,
      apiVersion: undefined,
      installationToken: "installation-token",
      page: 1,
      perPage: 100,
    });
    expect(listGitHubInstallationRepositoriesMock).toHaveBeenNthCalledWith(2, {
      apiBaseUrl: undefined,
      apiVersion: undefined,
      installationToken: "installation-token",
      page: 2,
      perPage: 100,
    });
  });

  it("stops listing GitHub repositories when totalCount has been reached", async () => {
    const page = Array.from({ length: 100 }, (_, index) =>
      liveRepository({
        fullName: `acme/repo-${index}`,
        id: String(200 + index),
        name: `repo-${index}`,
      })
    );
    listGitHubInstallationRepositoriesMock.mockResolvedValueOnce({
      repositories: page,
      totalCount: 100,
    });

    await expect(
      listAllGitHubInstallationRepositories({
        installationToken: "installation-token",
      })
    ).resolves.toEqual(page);

    expect(listGitHubInstallationRepositoriesMock).toHaveBeenCalledTimes(1);
  });
});
