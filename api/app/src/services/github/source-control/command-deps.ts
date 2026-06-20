import type { Database } from "@db/app";
import {
  getActiveOrgBinding,
  insertWatchedSourceControlRepository,
  listWatchedSourceControlRepositories,
} from "@db/app";
import {
  buildGitHubNewRepositoryUrl,
  buildGitHubRepositoryUrl,
  createGitHubAppJwt,
  createGitHubInstallationToken,
  getGitHubAppInstallation,
} from "@lightfast/connector-github/node";

import type { SourceControlCommandDeps } from "../../../domain/source-control";
import { getGitHubAppConfig } from "../config";
import { listAllGitHubInstallationRepositories } from "./repositories";

type SourceControlCommandDepOverrides = Partial<
  Omit<SourceControlCommandDeps, "db">
>;

export function createDefaultSourceControlCommandDeps(
  input: { db: Database } & SourceControlCommandDepOverrides
): SourceControlCommandDeps {
  return {
    buildGitHubNewRepositoryUrl:
      input.buildGitHubNewRepositoryUrl ?? buildGitHubNewRepositoryUrl,
    buildGitHubRepositoryUrl:
      input.buildGitHubRepositoryUrl ?? buildGitHubRepositoryUrl,
    createGitHubAppJwt: input.createGitHubAppJwt ?? createGitHubAppJwt,
    createGitHubInstallationToken:
      input.createGitHubInstallationToken ?? createGitHubInstallationToken,
    db: input.db,
    getActiveOrgBinding: input.getActiveOrgBinding ?? getActiveOrgBinding,
    getGitHubAppConfig: input.getGitHubAppConfig ?? getGitHubAppConfig,
    getGitHubAppInstallation:
      input.getGitHubAppInstallation ?? getGitHubAppInstallation,
    insertWatchedSourceControlRepository:
      input.insertWatchedSourceControlRepository ??
      insertWatchedSourceControlRepository,
    listAllGitHubInstallationRepositories:
      input.listAllGitHubInstallationRepositories ??
      listAllGitHubInstallationRepositories,
    listWatchedSourceControlRepositories:
      input.listWatchedSourceControlRepositories ??
      listWatchedSourceControlRepositories,
  };
}
