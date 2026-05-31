import { z } from "zod";

import { GitHubAppNodeError } from "./errors";
import {
  fetchGitHubJson,
  githubJsonHeaders,
  normalizeGitHubApiBaseUrl,
} from "./github-api";

const rawAuthenticatedUserSchema = z.object({
  id: z.union([z.number(), z.string().min(1)]),
  login: z.string().min(1),
  type: z.string().min(1),
});

export interface GitHubAuthenticatedUser {
  id: string;
  login: string;
  type: "User";
}

export interface GetGitHubAuthenticatedUserInput {
  apiBaseUrl?: string;
  apiVersion?: string;
  fetch?: typeof fetch;
  userAccessToken: string;
}

export async function getGitHubAuthenticatedUser(
  input: GetGitHubAuthenticatedUserInput
): Promise<GitHubAuthenticatedUser> {
  const url = new URL("/user", normalizeGitHubApiBaseUrl(input.apiBaseUrl));
  const { json, response } = await fetchGitHubJson({
    fetch: input.fetch,
    init: {
      headers: githubJsonHeaders({
        apiVersion: input.apiVersion,
        token: input.userAccessToken,
      }),
    },
    requestErrorCode: "GITHUB_USER_NOT_VERIFIED",
    requestErrorMessage: "GitHub authenticated user request failed.",
    url,
  });
  const parsed = rawAuthenticatedUserSchema.safeParse(json);
  if (!(response.ok && parsed.success && parsed.data.type === "User")) {
    throw new GitHubAppNodeError(
      "GITHUB_USER_NOT_VERIFIED",
      "GitHub authenticated user could not be verified."
    );
  }

  return {
    id: String(parsed.data.id),
    login: parsed.data.login,
    type: "User",
  };
}
