import type { SourceControlRepository } from "@db/app/schema";
import {
  githubLightfastRepositoryProofSchema,
  LIGHTFAST_REPOSITORY_NAME,
} from "@repo/app-setup-contract";
import {
  type GitHubInstallationRepository,
  listGitHubInstallationRepositories,
} from "@repo/github-app-node";

export interface SourceControlRepositoryRow {
  fullName: string;
  id: string;
  imported: boolean;
  name: string;
  owner: {
    id: string;
    login: string;
  };
  private: boolean;
  watchedPathGlobs: string[] | null;
}

export interface LightfastSourceControlRepositoryRow {
  fullName: string;
  id: string;
  name: typeof LIGHTFAST_REPOSITORY_NAME;
  verifiedAt: string;
}

export function lightfastRepositoryFromBinding(input: {
  metadata: Record<string, unknown>;
  providerInstallationId?: string | null;
}): LightfastSourceControlRepositoryRow | null {
  const parsed = githubLightfastRepositoryProofSchema.safeParse(
    input.metadata.lightfastRepository
  );

  if (!parsed.success) {
    return null;
  }

  if (
    input.providerInstallationId &&
    parsed.data.installationId !== input.providerInstallationId
  ) {
    return null;
  }

  return {
    fullName: parsed.data.fullName,
    id: parsed.data.id,
    name: parsed.data.name,
    verifiedAt: parsed.data.verifiedAt,
  };
}

export function lightfastRepositoryIdFromBinding(input: {
  metadata: Record<string, unknown>;
  providerInstallationId?: string | null;
}): string | null {
  return lightfastRepositoryFromBinding(input)?.id ?? null;
}

export function buildSourceControlRepositoryResponse(input: {
  binding: {
    id: number;
    metadata: Record<string, unknown>;
    providerAccountId: string | null;
  };
  liveRepositories: GitHubInstallationRepository[];
  watchedRepositories: SourceControlRepository[];
}): SourceControlRepositoryRow[] {
  const lightfastRepositoryId = lightfastRepositoryIdFromBinding(input.binding);
  const watchedByProviderId = new Map(
    input.watchedRepositories.map((repository) => [
      repository.providerRepositoryId,
      repository,
    ])
  );

  return input.liveRepositories
    .filter(
      (repository) => repository.ownerId === input.binding.providerAccountId
    )
    .filter((repository) => repository.id !== lightfastRepositoryId)
    .filter((repository) => repository.name !== LIGHTFAST_REPOSITORY_NAME)
    .map((repository) => {
      const watched = watchedByProviderId.get(repository.id);
      return {
        fullName: repository.fullName,
        id: repository.id,
        imported: Boolean(watched),
        name: repository.name,
        owner: {
          id: repository.ownerId,
          login: repository.ownerLogin,
        },
        private: repository.private,
        watchedPathGlobs: watched?.watchedPathGlobs ?? null,
      };
    });
}

export function countNormalImportedRepositories(input: {
  binding: {
    metadata: Record<string, unknown>;
  };
  watchedRepositories: SourceControlRepository[];
}): number {
  const lightfastRepositoryId = lightfastRepositoryIdFromBinding(input.binding);
  return input.watchedRepositories.filter(
    (repository) => repository.providerRepositoryId !== lightfastRepositoryId
  ).length;
}

export async function listAllGitHubInstallationRepositories(input: {
  apiBaseUrl?: string;
  apiVersion?: string;
  installationToken: string;
}): Promise<GitHubInstallationRepository[]> {
  const repositories: GitHubInstallationRepository[] = [];
  let page = 1;
  const perPage = 100;

  for (;;) {
    const result = await listGitHubInstallationRepositories({
      apiBaseUrl: input.apiBaseUrl,
      apiVersion: input.apiVersion,
      installationToken: input.installationToken,
      page,
      perPage,
    });
    repositories.push(...result.repositories);

    if (
      result.repositories.length < perPage ||
      (result.totalCount !== undefined &&
        repositories.length >= result.totalCount)
    ) {
      break;
    }

    page += 1;
  }

  return repositories;
}
