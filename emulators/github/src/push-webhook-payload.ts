import type { Store } from "@emulators/core";
import { getGitHubStore } from "@emulators/github";

const ZERO_SHA = "0".repeat(40);

type GitHubStore = ReturnType<typeof getGitHubStore>;
type GitHubTreeEntry = ReturnType<
  GitHubStore["trees"]["all"]
>[number]["tree"][number];

function findCommitBySha(gh: GitHubStore, repoId: number, sha: string) {
  return gh.commits
    .findBy("repo_id", repoId)
    .find((commit) => commit.sha === sha);
}

function findTreeBySha(gh: GitHubStore, repoId: number, sha: string) {
  return gh.trees.findBy("repo_id", repoId).find((tree) => tree.sha === sha);
}

function expandBlobEntries(input: {
  entries: readonly GitHubTreeEntry[];
  gh: GitHubStore;
  prefix?: string;
  repoId: number;
}): Map<string, string> {
  const paths = new Map<string, string>();

  for (const entry of input.entries) {
    const path = input.prefix ? `${input.prefix}/${entry.path}` : entry.path;
    if (entry.type === "blob") {
      paths.set(path, entry.sha);
      continue;
    }

    const subtree = findTreeBySha(input.gh, input.repoId, entry.sha);
    if (!subtree) {
      continue;
    }
    for (const [subPath, sha] of expandBlobEntries({
      entries: subtree.tree,
      gh: input.gh,
      prefix: path,
      repoId: input.repoId,
    })) {
      paths.set(subPath, sha);
    }
  }

  return paths;
}

function blobEntriesForCommit(input: {
  gh: GitHubStore;
  repoId: number;
  sha: string;
}): Map<string, string> {
  if (input.sha === ZERO_SHA) {
    return new Map();
  }

  const commit = findCommitBySha(input.gh, input.repoId, input.sha);
  if (!commit) {
    return new Map();
  }
  const tree = findTreeBySha(input.gh, input.repoId, commit.tree_sha);
  if (!tree) {
    return new Map();
  }

  return expandBlobEntries({
    entries: tree.tree,
    gh: input.gh,
    repoId: input.repoId,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readRepositoryId(
  payload: Record<string, unknown>
): number | undefined {
  const repository = payload.repository;
  if (!isRecord(repository)) {
    return;
  }

  const id = repository.id;
  if (typeof id === "number" && Number.isInteger(id)) {
    return id;
  }
  if (typeof id === "string") {
    const parsed = Number.parseInt(id, 10);
    return Number.isInteger(parsed) ? parsed : undefined;
  }
  return;
}

function diffTreePaths(input: {
  after: Map<string, string>;
  before: Map<string, string>;
}) {
  const added: string[] = [];
  const modified: string[] = [];
  const removed: string[] = [];

  for (const [path, afterSha] of input.after) {
    const beforeSha = input.before.get(path);
    if (!beforeSha) {
      added.push(path);
    } else if (beforeSha !== afterSha) {
      modified.push(path);
    }
  }
  for (const path of input.before.keys()) {
    if (!input.after.has(path)) {
      removed.push(path);
    }
  }

  return {
    added: added.sort(),
    modified: modified.sort(),
    removed: removed.sort(),
  };
}

export function enrichPushPayloadWithChangedPaths(input: {
  payload: unknown;
  store: Store;
}) {
  if (!isRecord(input.payload)) {
    return input.payload;
  }
  if (Array.isArray(input.payload.commits)) {
    return input.payload;
  }

  const repoId = readRepositoryId(input.payload);
  const beforeSha = readString(input.payload.before);
  const afterSha = readString(input.payload.after);
  if (!(repoId && beforeSha && afterSha)) {
    return input.payload;
  }

  const gh = getGitHubStore(input.store);
  const before = blobEntriesForCommit({ gh, repoId, sha: beforeSha });
  const after = blobEntriesForCommit({ gh, repoId, sha: afterSha });
  const changed = diffTreePaths({ after, before });

  return {
    ...input.payload,
    commits: [
      {
        id: afterSha,
        ...changed,
      },
    ],
  };
}
