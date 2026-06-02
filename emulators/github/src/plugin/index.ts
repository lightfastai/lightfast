import type { Store } from "@emulators/core";
import {
  getGitHubStore,
  githubPlugin,
  seedFromConfig,
} from "@emulators/github";
import {
  formatListenUrl,
  type StartedEmulator,
  startEmulator,
} from "@repo/emulator-kit";

import {
  createGitHubEmulatorSeed,
  GITHUB_EMULATOR_FIXTURES,
} from "../fixtures";
import { createGitHubCompatibleFetch } from "./compatible-routes";
import { enrichPushPayloadWithChangedPaths } from "./webhook/push-payload";

export interface StartGitHubEmulatorInput {
  appOrigin?: string;
  host?: string;
  port?: number;
  publicOrigin?: string;
}

export type StartedGitHubEmulator = StartedEmulator;

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

export function startGitHubEmulator(
  input: StartGitHubEmulatorInput = {}
): Promise<StartedGitHubEmulator> {
  const appOrigin = input.appOrigin ?? "https://lightfast.localhost";
  const host = input.host ?? "127.0.0.1";
  const port = input.port ?? 4567;
  // The emulator seeds and serves URL-bearing data (installation/avatar/html
  // URLs) built from the public origin, so it must be known before binding —
  // hence a concrete port rather than an OS-assigned ephemeral one.
  const publicOrigin = input.publicOrigin ?? formatListenUrl(host, port);

  let storeRef: Store | undefined;
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

  return startEmulator(githubPlugin, {
    appKeyResolver,
    appOrigin,
    host,
    port,
    publicOrigin,
    tokens: {
      [GITHUB_EMULATOR_FIXTURES.userToken]: {
        login: GITHUB_EMULATOR_FIXTURES.githubUserLogin,
        id: 1,
        scopes: ["repo", "user", "read:org", "admin:org"],
      },
    },
    seed: (server) => {
      server.store.reset();
      githubPlugin.seed?.(server.store, publicOrigin);
      seedFromConfig(
        server.store,
        publicOrigin,
        createGitHubEmulatorSeed(appOrigin)
      );
      addOrgMembership(server.store);
    },
    onReady: (server) => {
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
    },
    createFetch: (server, ctx) =>
      createGitHubCompatibleFetch({
        appOrigin,
        fallbackFetch: server.app.fetch,
        publicOrigin,
        resetStore: ctx.reset,
        store: server.store,
        tokenMap: server.tokenMap,
      }),
  });
}
