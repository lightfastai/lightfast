import {
  GitHubAppNodeError,
  getGitHubBlobText,
  getGitHubCommit,
  getGitHubRepository,
  getGitHubReference,
  getGitHubTree,
} from "@repo/github-app-node";

import { getGitHubAppConfig } from "../github/config";
import { getCachedGitHubInstallationToken } from "../github/installation-token-cache";

export async function readIdentityRepositoryMainRef(input: {
  etag?: string | null;
  fullName: string;
  installationId: string;
  signal?: AbortSignal;
}) {
  input.signal?.throwIfAborted();
  const config = getGitHubAppConfig();
  const { owner, repo } = splitRepositoryFullName(input.fullName);
  const installationToken = await getCachedGitHubInstallationToken({
    installationId: input.installationId,
    signal: input.signal,
  });
  try {
    const repository = await getGitHubRepository({
      apiBaseUrl: config.endpoints.apiBaseUrl,
      apiVersion: config.apiVersion,
      installationToken,
      owner,
      repo,
      signal: input.signal,
    });
    const reference = await getGitHubReference({
      apiBaseUrl: config.endpoints.apiBaseUrl,
      apiVersion: config.apiVersion,
      etag: input.etag,
      installationToken,
      owner,
      ref: `heads/${repository.defaultBranch}`,
      repo,
      signal: input.signal,
    });
    return {
      ...reference,
      defaultBranch: repository.defaultBranch,
    };
  } catch (error) {
    if (
      error instanceof GitHubAppNodeError &&
      error.code === "GITHUB_REF_NOT_FOUND"
    ) {
      return { status: "missing" as const };
    }
    throw error;
  }
}

export async function readIdentityRepositoryTree(input: {
  commitSha: string;
  fullName: string;
  installationId: string;
  signal?: AbortSignal;
}) {
  input.signal?.throwIfAborted();
  const config = getGitHubAppConfig();
  const { owner, repo } = splitRepositoryFullName(input.fullName);
  const installationToken = await getCachedGitHubInstallationToken({
    installationId: input.installationId,
    signal: input.signal,
  });
  const commit = await getGitHubCommit({
    apiBaseUrl: config.endpoints.apiBaseUrl,
    apiVersion: config.apiVersion,
    installationToken,
    owner,
    ref: input.commitSha,
    repo,
    signal: input.signal,
  });
  input.signal?.throwIfAborted();
  const tree = await getGitHubTree({
    apiBaseUrl: config.endpoints.apiBaseUrl,
    apiVersion: config.apiVersion,
    installationToken,
    owner,
    recursive: true,
    repo,
    signal: input.signal,
    treeSha: commit.treeSha,
  });
  return {
    commit,
    tree: {
      ...tree,
      tree: tree.tree.map((entry) => ({ ...entry })),
    },
  };
}

export async function readIdentityRepositoryBlob(input: {
  fullName: string;
  installationId: string;
  signal?: AbortSignal;
  sha: string;
}) {
  input.signal?.throwIfAborted();
  const config = getGitHubAppConfig();
  const { owner, repo } = splitRepositoryFullName(input.fullName);
  const installationToken = await getCachedGitHubInstallationToken({
    installationId: input.installationId,
    signal: input.signal,
  });
  return await getGitHubBlobText({
    apiBaseUrl: config.endpoints.apiBaseUrl,
    apiVersion: config.apiVersion,
    installationToken,
    owner,
    repo,
    signal: input.signal,
    sha: input.sha,
  });
}

function splitRepositoryFullName(fullName: string): {
  owner: string;
  repo: string;
} {
  const [owner, repo, ...rest] = fullName.split("/");
  if (!(owner && repo) || rest.length > 0) {
    throw new Error(`Invalid GitHub repository full name: ${fullName}`);
  }
  return { owner, repo };
}
