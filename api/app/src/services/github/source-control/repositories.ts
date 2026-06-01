import type { SourceControlRepository } from "@db/app/schema";
import { githubLightfastRepositoryProofSchema } from "@repo/app-setup-contract";
import {
  listGitHubInstallationRepositories,
  type GitHubInstallationRepository,
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

export function lightfastRepositoryIdFromBinding(input: {
  metadata: Record<string, unknown>;
}): string | null {
  const parsed = githubLightfastRepositoryProofSchema.safeParse(
    input.metadata.lightfastRepository
  );
  return parsed.success ? parsed.data.id : null;
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
    .filter((repository) => repository.ownerId === input.binding.providerAccountId)
    .filter((repository) => repository.id !== lightfastRepositoryId)
    .filter((repository) => repository.name !== ".lightfast")
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
      (result.totalCount !== undefined && repositories.length >= result.totalCount)
    ) {
      break;
    }

    page += 1;
  }

  return repositories;
}
