import { z } from "zod";

import { GitHubAppNodeError } from "./errors";
import {
  fetchGitHubJson,
  githubJsonHeaders,
  githubPathSegment,
  normalizeGitHubApiBaseUrl,
} from "./github-api";

const nullableStringSchema = z.string().nullable().optional();

const rawAuthenticatedUserSchema = z.object({
  id: z.union([z.number(), z.string().min(1)]),
  login: z.string().min(1),
  type: z.string().min(1),
});

const rawGitHubUserSchema = z.object({
  bio: nullableStringSchema,
  blog: nullableStringSchema,
  company: nullableStringSchema,
  email: nullableStringSchema,
  id: z.union([z.number(), z.string().min(1)]),
  location: nullableStringSchema,
  login: z.string().min(1),
  name: nullableStringSchema,
  twitter_username: nullableStringSchema,
  type: z.string().min(1),
});

export interface GitHubAuthenticatedUser {
  id: string;
  login: string;
  type: "User";
}

interface GetGitHubAuthenticatedUserInput {
  apiBaseUrl?: string;
  apiVersion?: string;
  fetch?: typeof fetch;
  userAccessToken: string;
}

export interface GitHubUserProfile {
  bio?: string | null;
  blog?: string | null;
  company?: string | null;
  email?: string | null;
  id: string;
  location?: string | null;
  login: string;
  name?: string | null;
  twitterUsername?: string | null;
  type: "User";
}

export interface GetGitHubUserByLoginInput {
  apiBaseUrl?: string;
  apiVersion?: string;
  fetch?: typeof fetch;
  login: string;
  token: string;
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

export async function getGitHubUserByLogin(
  input: GetGitHubUserByLoginInput
): Promise<GitHubUserProfile> {
  const login = input.login.trim();
  if (!login) {
    throw new GitHubAppNodeError(
      "GITHUB_API_RESPONSE_INVALID",
      "GitHub user login is required."
    );
  }

  const url = new URL(
    `/users/${githubPathSegment(login)}`,
    normalizeGitHubApiBaseUrl(input.apiBaseUrl)
  );
  const { json, response } = await fetchGitHubJson({
    fetch: input.fetch,
    init: {
      headers: githubJsonHeaders({
        apiVersion: input.apiVersion,
        token: input.token,
      }),
    },
    requestErrorCode: "GITHUB_API_REQUEST_FAILED",
    requestErrorMessage: "GitHub user profile request failed.",
    url,
  });
  const parsed = rawGitHubUserSchema.safeParse(json);
  if (!(response.ok && parsed.success && parsed.data.type === "User")) {
    throw new GitHubAppNodeError(
      "GITHUB_API_RESPONSE_INVALID",
      "GitHub user profile response was invalid."
    );
  }

  return {
    bio: parsed.data.bio,
    blog: parsed.data.blog,
    company: parsed.data.company,
    email: parsed.data.email,
    id: String(parsed.data.id),
    location: parsed.data.location,
    login: parsed.data.login,
    name: parsed.data.name,
    twitterUsername: parsed.data.twitter_username,
    type: "User",
  };
}
