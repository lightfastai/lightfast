import type { Server } from "node:http";
import { createServer, serve } from "@emulators/core";
import { getGitHubStore, githubPlugin, seedFromConfig } from "@emulators/github";

import { createGitHubEmulatorSeed, GITHUB_EMULATOR_FIXTURES } from "./fixtures";

export interface StartGitHubEmulatorInput {
  port?: number;
}

export interface StartedGitHubEmulator {
  close(): Promise<void>;
  reset(): void;
  url: string;
}

export function addOrgMembership(
  store: Parameters<typeof getGitHubStore>[0]
) {
  const gh = getGitHubStore(store);
  const org = gh.orgs.findOneBy("login", GITHUB_EMULATOR_FIXTURES.githubOrgLogin);
  const user = gh.users.findOneBy(
    "login",
    GITHUB_EMULATOR_FIXTURES.githubUserLogin
  );

  if (!org || !user) {
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

export async function startGitHubEmulator(
  input: StartGitHubEmulatorInput = {}
): Promise<StartedGitHubEmulator> {
  const port = input.port ?? 4567;
  const url = `http://127.0.0.1:${port}`;
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
    baseUrl: url,
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

  function seed() {
    server.store.reset();
    githubPlugin.seed?.(server.store, url);
    seedFromConfig(server.store, url, createGitHubEmulatorSeed());
    addOrgMembership(server.store);
  }

  seed();

  const httpServer: Server = serve({
    fetch: server.app.fetch,
    hostname: "127.0.0.1",
    port,
  });

  await waitForListening(httpServer).catch(async (error: unknown) => {
    await closeServer(httpServer).catch(() => {});
    throw error;
  });

  let closed = false;

  return {
    url,
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
