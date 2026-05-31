import { z } from "zod";

import { GitHubAppNodeError } from "./errors";
import {
  fetchGitHubJson,
  githubJsonHeaders,
  githubPathSegment,
  normalizeGitHubApiBaseUrl,
} from "./github-api";

const repositoryInstallationSchema = z.object({
  id: z.union([z.number(), z.string().min(1)]),
  repository_selection: z.enum(["all", "selected"]).optional(),
});

export async function verifyGitHubInstallationRepository(input: {
  apiBaseUrl?: string;
  apiVersion?: string;
  appJwt: string;
  expectedInstallationId: string;
  fetch?: typeof fetch;
  owner: string;
  repo: string;
}): Promise<{
  installationId: string;
  repositorySelection: "all" | "selected";
}> {
  const apiBaseUrl = normalizeGitHubApiBaseUrl(input.apiBaseUrl);
  const url = `${apiBaseUrl}/repos/${githubPathSegment(
    input.owner
  )}/${githubPathSegment(input.repo)}/installation`;

  const { json, response } = await fetchGitHubJson({
    fetch: input.fetch,
    init: {
      headers: githubJsonHeaders({
        apiVersion: input.apiVersion,
        token: input.appJwt,
      }),
    },
    requestErrorCode: "GITHUB_API_REQUEST_FAILED",
    requestErrorMessage: "GitHub repository installation request failed.",
    url,
  });

  if (response.status === 404) {
    throw new GitHubAppNodeError(
      "GITHUB_REPOSITORY_NOT_FOUND",
      "GitHub repository installation was not found."
    );
  }
  if (!response.ok) {
    throw new GitHubAppNodeError(
      "GITHUB_API_RESPONSE_INVALID",
      "GitHub repository installation response was not successful."
    );
  }

  const parsed = repositoryInstallationSchema.safeParse(json);
  if (!parsed.success) {
    throw new GitHubAppNodeError(
      "GITHUB_API_RESPONSE_INVALID",
      "GitHub repository installation response was invalid."
    );
  }

  const installationId = String(parsed.data.id);
  if (installationId !== input.expectedInstallationId) {
    throw new GitHubAppNodeError(
      "GITHUB_REPOSITORY_INACCESSIBLE",
      "GitHub repository is attached to a different installation."
    );
  }

  return {
    installationId,
    repositorySelection: parsed.data.repository_selection ?? "all",
  };
}
