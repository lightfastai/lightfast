import type { Server } from "node:http";
import type { Store } from "@emulators/core";
import { createServer, serve } from "@emulators/core";
import {
  getGitHubStore,
  githubPlugin,
  seedFromConfig,
} from "@emulators/github";

import { createGitHubEmulatorSeed, GITHUB_EMULATOR_FIXTURES } from "./fixtures";
import { createGitHubCompatibleFetch } from "./github-compatible-routes";

export interface StartGitHubEmulatorInput {
  appOrigin?: string;
  host?: string;
  port?: number;
  publicOrigin?: string;
}

export interface StartedGitHubEmulator {
  close(): Promise<void>;
  listenUrl: string;
  publicOrigin: string;
  reset(): void;
  store: Store;
  url: string;
}

const ZERO_SHA = "0".repeat(40);

export function addOrgMembership(store: Parameters<typeof getGitHubStore>[0]) {
  const gh = getGitHubStore(store);
  const org = gh.orgs.findOneBy(
    "login",
    GITHUB_EMULATOR_FIXTURES.githubOrgLogin
  );
  const user = gh.users.findOneBy(
    "login",
    GITHUB_EMULATOR_FIXTURES.githubUserLogin
  );

  if (!(org && user)) {
    throw new Error("GitHub emulator seed did not create org and user");
  }

  let membersTeam = gh.teams
    .findBy("org_id", org.id)
    .find((team) => team.slug === "members");

  if (!membersTeam) {
    membersTeam = gh.teams.insert({
      node_id: "",
      name: "Members",
      slug: "members",
      description: "Default org members",
      privacy: "closed",
      permission: "pull",
      org_id: org.id,
      parent_id: null,
      members_count: 0,
      repos_count: 0,
    });
  }

  const existingMembership = gh.teamMembers
    .findBy("team_id", membersTeam.id)
    .find((membership) => membership.user_id === user.id);

  if (!existingMembership) {
    gh.teamMembers.insert({
      team_id: membersTeam.id,
      user_id: user.id,
      role: "maintainer",
    });
    gh.teams.update(membersTeam.id, {
      members_count: gh.teamMembers.findBy("team_id", membersTeam.id).length,
    });
  }
}

function waitForListening(httpServer: Server) {
  if (httpServer.listening) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      httpServer.off("error", onError);
      httpServer.off("listening", onListening);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onListening = () => {
      cleanup();
      resolve();
    };

    httpServer.once("error", onError);
    httpServer.once("listening", onListening);

    if (httpServer.listening) {
      onListening();
    }
  });
}

function closeServer(httpServer: Server) {
  if (!httpServer.listening) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    httpServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function formatListenUrl(host: string, port: number) {
  const urlHost = host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
  const formattedHost = urlHost.includes(":") ? `[${urlHost}]` : urlHost;
  return `http://${formattedHost}:${port}`;
}

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

function enrichPushPayloadWithChangedPaths(input: {
  payload: unknown;
  store: Parameters<typeof getGitHubStore>[0];
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

export async function startGitHubEmulator(
  input: StartGitHubEmulatorInput = {}
): Promise<StartedGitHubEmulator> {
  const appOrigin = input.appOrigin ?? "https://lightfast.localhost";
  const host = input.host ?? "127.0.0.1";
  const port = input.port ?? 4567;
  const listenUrl = formatListenUrl(host, port);
  const publicOrigin = input.publicOrigin ?? listenUrl;
  let storeRef: ReturnType<typeof createServer>["store"] | undefined;

  const appKeyResolver = (appId: number) => {
    const store = storeRef;
    if (!store) {
      return null;
    }

    const gh = getGitHubStore(store);
    const ghApp = gh.apps.all().find((app) => app.app_id === appId);
    if (!ghApp) {
      return null;
    }

    return {
      privateKey: ghApp.private_key,
      slug: ghApp.slug,
      name: ghApp.name,
    };
  };

  const server = createServer(githubPlugin, {
    appKeyResolver,
    baseUrl: publicOrigin,
    port,
    tokens: {
      [GITHUB_EMULATOR_FIXTURES.userToken]: {
        login: GITHUB_EMULATOR_FIXTURES.githubUserLogin,
        id: 1,
        scopes: ["repo", "user", "read:org", "admin:org"],
      },
    },
  });
  storeRef = server.store;

  const dispatch = server.webhooks.dispatch.bind(server.webhooks);
  server.webhooks.dispatch = (async (event, action, payload, owner, repo) =>
    dispatch(
      event,
      action,
      event === "push"
        ? enrichPushPayloadWithChangedPaths({
            payload,
            store: server.store,
          })
        : payload,
      owner,
      repo
    )) as typeof server.webhooks.dispatch;

  function seed() {
    server.store.reset();
    githubPlugin.seed?.(server.store, publicOrigin);
    seedFromConfig(
      server.store,
      publicOrigin,
      createGitHubEmulatorSeed(appOrigin)
    );
    addOrgMembership(server.store);
  }

  seed();

  const httpServer: Server = serve({
    fetch: createGitHubCompatibleFetch({
      appOrigin,
      fallbackFetch: server.app.fetch,
      publicOrigin,
      resetStore: seed,
      store: server.store,
      tokenMap: server.tokenMap,
    }),
    hostname: host,
    port,
  });

  await waitForListening(httpServer).catch(async (error: unknown) => {
    await closeServer(httpServer).catch(() => undefined);
    throw error;
  });

  let closed = false;

  return {
    listenUrl,
    publicOrigin,
    store: server.store,
    url: listenUrl,
    reset: seed,
    close: async () => {
      if (closed) {
        return;
      }
      closed = true;
      await closeServer(httpServer);
    },
  };
}
