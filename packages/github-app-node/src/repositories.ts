import { z } from "zod";
import { GitHubAppNodeError } from "./errors";
import {
  fetchGitHubJson,
  githubJsonHeaders,
  githubPathSegment,
  normalizeGitHubApiBaseUrl,
} from "./github-api";

const commitResponseSchema = z.object({
  sha: z.string().min(1),
  commit: z
    .object({
      tree: z.object({
        sha: z.string().min(1),
      }),
    })
    .optional(),
  tree: z
    .object({
      sha: z.string().min(1),
    })
    .optional(),
});

const referenceResponseSchema = z.object({
  object: z.object({
    sha: z.string().min(1),
    type: z.string().min(1),
  }),
});

const blobResponseSchema = z.object({
  content: z.string(),
  encoding: z.literal("base64"),
  sha: z.string().min(1),
  size: z.number().int().nonnegative(),
});

const treeResponseSchema = z.object({
  sha: z.string().min(1),
  tree: z.array(
    z.object({
      mode: z.string().min(1),
      path: z.string().min(1),
      sha: z.string().min(1),
      size: z.number().int().nonnegative().optional(),
      type: z.enum(["blob", "tree", "commit"]),
    })
  ),
  truncated: z.boolean().optional(),
});

const repositoryResponseSchema = z.object({
  full_name: z.string().min(1),
  id: z.union([z.number(), z.string().min(1)]),
  name: z.string().min(1),
  default_branch: z.string().min(1).optional(),
  owner: z.object({
    login: z.string().min(1),
  }),
});

function throwBlobDecodeFailed(): never {
  throw new GitHubAppNodeError(
    "GITHUB_BLOB_DECODE_FAILED",
    "GitHub blob content could not be decoded."
  );
}

function decodeBlobText(content: string): string {
  const normalized = content.replace(/\s/g, "");
  if (
    !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) ||
    normalized.length % 4 === 1
  ) {
    throwBlobDecodeFailed();
  }

  if (normalized.includes("=") && normalized.length % 4 !== 0) {
    throwBlobDecodeFailed();
  }

  const unpadded = normalized.replace(/=+$/, "");
  const paddingLength = (4 - (unpadded.length % 4)) % 4;
  if (paddingLength === 3) {
    throwBlobDecodeFailed();
  }

  const canonical = `${unpadded}${"=".repeat(paddingLength)}`;
  try {
    const bytes = Buffer.from(canonical, "base64");
    if (bytes.toString("base64") !== canonical) {
      throwBlobDecodeFailed();
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    if (error instanceof GitHubAppNodeError) {
      throw error;
    }
    throwBlobDecodeFailed();
  }
}

const installationRepositoriesResponseSchema = z.object({
  repositories: z.array(
    z.object({
      full_name: z.string().min(1),
      id: z.union([z.number(), z.string().min(1)]),
      name: z.string().min(1),
      owner: z.object({
        id: z.union([z.number(), z.string().min(1)]),
        login: z.string().min(1),
      }),
      private: z.boolean(),
    })
  ),
  total_count: z.number().int().min(0).optional(),
});

function normalizeGitHubPerPage(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) {
    return 100;
  }

  return Math.min(100, Math.max(1, Math.trunc(value)));
}

function normalizeGitHubPage(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.trunc(value));
}

export interface GitHubInstallationRepository {
  fullName: string;
  id: string;
  name: string;
  ownerId: string;
  ownerLogin: string;
  private: boolean;
}

async function getJson(input: {
  apiVersion?: string;
  fetch?: typeof fetch;
  installationToken: string;
  signal?: AbortSignal;
  url: string | URL;
}) {
  const { json, response } = await fetchGitHubJson({
    fetch: input.fetch,
    init: {
      headers: githubJsonHeaders({
        apiVersion: input.apiVersion,
        token: input.installationToken,
      }),
      signal: input.signal,
    },
    requestErrorCode: "GITHUB_API_REQUEST_FAILED",
    requestErrorMessage: "GitHub repository request failed.",
    url: input.url,
  });
  if (!response.ok) {
    throw new GitHubAppNodeError(
      "GITHUB_API_RESPONSE_INVALID",
      "GitHub repository response was not successful."
    );
  }
  return json;
}

export async function listGitHubInstallationRepositories(input: {
  apiBaseUrl?: string;
  apiVersion?: string;
  fetch?: typeof fetch;
  installationToken: string;
  page?: number;
  perPage?: number;
}): Promise<{
  repositories: GitHubInstallationRepository[];
  totalCount?: number;
}> {
  const apiBaseUrl = normalizeGitHubApiBaseUrl(input.apiBaseUrl);
  const page = normalizeGitHubPage(input.page);
  const perPage = normalizeGitHubPerPage(input.perPage);
  const url = new URL("/installation/repositories", apiBaseUrl);
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("page", String(page));

  const json = await getJson({
    apiVersion: input.apiVersion,
    fetch: input.fetch,
    installationToken: input.installationToken,
    url,
  });
  const parsed = installationRepositoriesResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new GitHubAppNodeError(
      "GITHUB_API_RESPONSE_INVALID",
      "GitHub installation repositories response was invalid."
    );
  }

  return {
    repositories: parsed.data.repositories.map((repository) => ({
      fullName: repository.full_name,
      id: String(repository.id),
      name: repository.name,
      ownerId: String(repository.owner.id),
      ownerLogin: repository.owner.login,
      private: repository.private,
    })),
    totalCount: parsed.data.total_count,
  };
}

export async function getGitHubCommit(input: {
  apiBaseUrl?: string;
  apiVersion?: string;
  fetch?: typeof fetch;
  installationToken: string;
  owner: string;
  ref: string;
  repo: string;
  signal?: AbortSignal;
}): Promise<{ sha: string; treeSha: string }> {
  const apiBaseUrl = normalizeGitHubApiBaseUrl(input.apiBaseUrl);
  const url = `${apiBaseUrl}/repos/${githubPathSegment(
    input.owner
  )}/${githubPathSegment(input.repo)}/git/commits/${githubPathSegment(
    input.ref
  )}`;
  const json = await getJson({
    apiVersion: input.apiVersion,
    fetch: input.fetch,
    installationToken: input.installationToken,
    signal: input.signal,
    url,
  });
  const parsed = commitResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new GitHubAppNodeError(
      "GITHUB_API_RESPONSE_INVALID",
      "GitHub commit response was invalid."
    );
  }
  const treeSha = parsed.data.tree?.sha ?? parsed.data.commit?.tree.sha;
  if (!treeSha) {
    throw new GitHubAppNodeError(
      "GITHUB_API_RESPONSE_INVALID",
      "GitHub commit response was invalid."
    );
  }
  return { sha: parsed.data.sha, treeSha };
}

export async function getGitHubReference(input: {
  apiBaseUrl?: string;
  apiVersion?: string;
  etag?: string | null;
  fetch?: typeof fetch;
  installationToken: string;
  owner: string;
  ref: string;
  repo: string;
  signal?: AbortSignal;
}): Promise<
  | { status: "found"; sha: string; etag: string | null }
  | { status: "not_modified" }
> {
  const apiBaseUrl = normalizeGitHubApiBaseUrl(input.apiBaseUrl);
  const encodedRef = input.ref.split("/").map(githubPathSegment).join("/");
  const url = `${apiBaseUrl}/repos/${githubPathSegment(
    input.owner
  )}/${githubPathSegment(input.repo)}/git/ref/${encodedRef}`;
  const { json, response } = await fetchGitHubJson({
    fetch: input.fetch,
    init: {
      headers: {
        ...githubJsonHeaders({
          apiVersion: input.apiVersion,
          token: input.installationToken,
        }),
        ...(input.etag ? { "if-none-match": input.etag } : {}),
      },
      signal: input.signal,
    },
    requestErrorCode: "GITHUB_API_REQUEST_FAILED",
    requestErrorMessage: "GitHub repository request failed.",
    url,
  });

  if (response.status === 304) {
    return { status: "not_modified" };
  }
  if (response.status === 404) {
    throw new GitHubAppNodeError(
      "GITHUB_REF_NOT_FOUND",
      "GitHub reference was not found."
    );
  }
  if (!response.ok) {
    throw new GitHubAppNodeError(
      "GITHUB_API_RESPONSE_INVALID",
      "GitHub reference response was not successful."
    );
  }

  const parsed = referenceResponseSchema.safeParse(json);
  if (!parsed.success || parsed.data.object.type !== "commit") {
    throw new GitHubAppNodeError(
      "GITHUB_API_RESPONSE_INVALID",
      "GitHub reference response was invalid."
    );
  }

  return {
    etag: response.headers.get("etag"),
    sha: parsed.data.object.sha,
    status: "found",
  };
}

export async function getGitHubRepository(input: {
  apiBaseUrl?: string;
  apiVersion?: string;
  fetch?: typeof fetch;
  installationToken: string;
  owner: string;
  repo: string;
  signal?: AbortSignal;
}): Promise<{
  fullName: string;
  id: string;
  name: string;
  owner: string;
  defaultBranch: string;
}> {
  const apiBaseUrl = normalizeGitHubApiBaseUrl(input.apiBaseUrl);
  const url = `${apiBaseUrl}/repos/${githubPathSegment(
    input.owner
  )}/${githubPathSegment(input.repo)}`;
  const json = await getJson({
    apiVersion: input.apiVersion,
    fetch: input.fetch,
    installationToken: input.installationToken,
    signal: input.signal,
    url,
  });
  const parsed = repositoryResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new GitHubAppNodeError(
      "GITHUB_API_RESPONSE_INVALID",
      "GitHub repository response was invalid."
    );
  }
  return {
    fullName: parsed.data.full_name,
    id: String(parsed.data.id),
    name: parsed.data.name,
    owner: parsed.data.owner.login,
    defaultBranch: parsed.data.default_branch ?? "main",
  };
}

export async function getGitHubTree(input: {
  apiBaseUrl?: string;
  apiVersion?: string;
  fetch?: typeof fetch;
  installationToken: string;
  owner: string;
  recursive?: boolean;
  repo: string;
  signal?: AbortSignal;
  treeSha: string;
}): Promise<z.infer<typeof treeResponseSchema>> {
  const apiBaseUrl = normalizeGitHubApiBaseUrl(input.apiBaseUrl);
  const url = new URL(
    `${apiBaseUrl}/repos/${githubPathSegment(input.owner)}/${githubPathSegment(
      input.repo
    )}/git/trees/${githubPathSegment(input.treeSha)}`
  );
  if (input.recursive) {
    url.searchParams.set("recursive", "1");
  }
  const json = await getJson({
    apiVersion: input.apiVersion,
    fetch: input.fetch,
    installationToken: input.installationToken,
    signal: input.signal,
    url: url.toString(),
  });
  const parsed = treeResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new GitHubAppNodeError(
      "GITHUB_API_RESPONSE_INVALID",
      "GitHub tree response was invalid."
    );
  }
  return parsed.data;
}

export async function getGitHubBlobText(input: {
  apiBaseUrl?: string;
  apiVersion?: string;
  fetch?: typeof fetch;
  installationToken: string;
  owner: string;
  repo: string;
  signal?: AbortSignal;
  sha: string;
}): Promise<{ sha: string; size: number; text: string }> {
  const apiBaseUrl = normalizeGitHubApiBaseUrl(input.apiBaseUrl);
  const url = `${apiBaseUrl}/repos/${githubPathSegment(
    input.owner
  )}/${githubPathSegment(input.repo)}/git/blobs/${githubPathSegment(
    input.sha
  )}`;
  const { json, response } = await fetchGitHubJson({
    fetch: input.fetch,
    init: {
      headers: githubJsonHeaders({
        apiVersion: input.apiVersion,
        token: input.installationToken,
      }),
      signal: input.signal,
    },
    requestErrorCode: "GITHUB_API_REQUEST_FAILED",
    requestErrorMessage: "GitHub repository request failed.",
    url,
  });

  if (response.status === 404) {
    throw new GitHubAppNodeError(
      "GITHUB_BLOB_NOT_FOUND",
      "GitHub blob was not found."
    );
  }
  if (!response.ok) {
    throw new GitHubAppNodeError(
      "GITHUB_API_RESPONSE_INVALID",
      "GitHub blob response was not successful."
    );
  }

  const parsed = blobResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new GitHubAppNodeError(
      "GITHUB_API_RESPONSE_INVALID",
      "GitHub blob response was invalid."
    );
  }

  return {
    sha: parsed.data.sha,
    size: parsed.data.size,
    text: decodeBlobText(parsed.data.content),
  };
}
