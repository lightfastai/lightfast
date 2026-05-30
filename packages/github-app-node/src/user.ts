import { z } from "zod";

import { GitHubAppNodeError } from "./errors";

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
  signal?: AbortSignal;
  userAccessToken: string;
}

function normalizeApiBaseUrl(value: string | undefined) {
  return (value ?? "https://api.github.com").replace(/\/+$/, "");
}

export async function getGitHubAuthenticatedUser(
  input: GetGitHubAuthenticatedUserInput
): Promise<GitHubAuthenticatedUser> {
  const requestFetch = input.fetch ?? fetch;
  const url = new URL("/user", normalizeApiBaseUrl(input.apiBaseUrl));

  let res: Response;
  try {
    res = await requestFetch(url.toString(), {
      signal: input.signal,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${input.userAccessToken}`,
        ...(input.apiVersion
          ? { "x-github-api-version": input.apiVersion }
          : {}),
      },
    });
  } catch {
    throw new GitHubAppNodeError(
      "GITHUB_USER_NOT_VERIFIED",
      "GitHub authenticated user request failed."
    );
  }

  const json = await res.json().catch(() => null);
  const parsed = rawAuthenticatedUserSchema.safeParse(json);
  if (!(res.ok && parsed.success && parsed.data.type === "User")) {
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
