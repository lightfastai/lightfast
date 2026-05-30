# GitHub Org Binding Emulator Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an emulator-first vertical slice for GitHub org binding so local development can exercise `GITHUB_INSTALL_URL_OVERRIDE -> /api/dev/github/install -> /api/github/setup -> emulator OAuth -> /api/github/oauth/callback -> DB binding -> Clerk claim sync`.

**Architecture:** This slice keeps production binding disabled unless `GITHUB_INSTALL_URL_OVERRIDE` is present in a non-production runtime. A dev-only `emulators/github` package owns deterministic GitHub fixture data and starts `@emulators/github` programmatically, while `api/app` owns attempts, emulator verification, DB finalization, and Clerk mirroring. `apps/app` remains thin: setup/OAuth/dev-install route handlers delegate to `api/app`, and the bind UI only starts the tRPC flow and navigates externally.

**Tech Stack:** pnpm workspaces, Turborepo, Next.js App Router route handlers, tRPC v11, Clerk, Upstash Redis, Drizzle MySQL helpers, `vercel-labs/emulate@0.6.0`, `@emulators/github@0.6.0`, `@emulators/core@0.6.0`, Zod, Jose, Vitest, Testing Library.

---

## Scope

In scope:

- Add dev-only emulator package `emulators/github` with deterministic GitHub user/org/repo/OAuth app/GitHub App/installation fixtures.
- Patch `@emulators/core@0.6.0` and `emulate@0.6.0` so valid GitHub App JWTs verify with a derived public key.
- Add minimal `@repo/github-app-contract` and `@repo/github-app-node` packages needed by the emulator slice.
- Add GitHub bind attempts in `api/app` using Redis state records with 15-minute TTL.
- Add `org.setup.github.start` and `org.setup.github.syncBindingClaim`.
- Add emulator setup/OAuth callbacks and the dev install shim.
- Replace the bind card's placeholder `task.bind` product path with the emulator-aware GitHub start flow.
- Add a completion page that retries Clerk binding-claim sync and reloads the Clerk session.
- Add focused unit and integration tests for the local emulator path.

Out of scope for this plan:

- Real GitHub App installation URL enablement when `GITHUB_INSTALL_URL_OVERRIDE` is absent.
- Real GitHub `GET /user/installations` verification.
- Production GitHub webhooks and uninstall/revocation handling.
- Scheduled reconciliation and failed webhook redelivery checks.
- GitHub-first install recovery.

Production guardrail:

- `org.setup.github.start` must reject in production.
- `org.setup.github.start` must reject in non-production when `GITHUB_INSTALL_URL_OVERRIDE` is absent for this slice.
- `/api/dev/github/install` must reject in production and when the configured override is absent.

## File Structure

Create:

- `packages/github-app-contract/package.json`
- `packages/github-app-contract/tsconfig.json`
- `packages/github-app-contract/vitest.config.ts`
- `packages/github-app-contract/src/index.ts`
- `packages/github-app-contract/src/github-app.ts`
- `packages/github-app-contract/src/__tests__/github-app.test.ts`
- `packages/github-app-node/package.json`
- `packages/github-app-node/tsconfig.json`
- `packages/github-app-node/vitest.config.ts`
- `packages/github-app-node/src/index.ts`
- `packages/github-app-node/src/errors.ts`
- `packages/github-app-node/src/pkce.ts`
- `packages/github-app-node/src/urls.ts`
- `packages/github-app-node/src/oauth.ts`
- `packages/github-app-node/src/app-jwt.ts`
- `packages/github-app-node/src/emulator-verifier.ts`
- `packages/github-app-node/src/__tests__/pkce.test.ts`
- `packages/github-app-node/src/__tests__/urls.test.ts`
- `packages/github-app-node/src/__tests__/oauth.test.ts`
- `packages/github-app-node/src/__tests__/app-jwt.test.ts`
- `packages/github-app-node/src/__tests__/emulator-verifier.test.ts`
- `emulators/github/package.json`
- `emulators/github/tsconfig.json`
- `emulators/github/vitest.config.ts`
- `emulators/github/README.md`
- `emulators/github/src/fixtures.ts`
- `emulators/github/src/server.ts`
- `emulators/github/src/start.ts`
- `emulators/github/src/__tests__/server.test.ts`
- `api/app/src/github/config.ts`
- `api/app/src/github/bind-attempts.ts`
- `api/app/src/github/admin-access.ts`
- `api/app/src/github/setup-flow.ts`
- `api/app/src/github/index.ts`
- `api/app/src/router/(pending-not-allowed)/github-setup.ts`
- `api/app/src/__tests__/github-bind-attempts.test.ts`
- `api/app/src/__tests__/github-config.test.ts`
- `api/app/src/__tests__/github-setup-flow.test.ts`
- `api/app/src/__tests__/github-setup-router.test.ts`
- `apps/app/src/app/(app)/(github)/api/github/setup/route.ts`
- `apps/app/src/app/(app)/(github)/api/github/oauth/callback/route.ts`
- `apps/app/src/app/(app)/(github)/api/dev/github/install/route.ts`
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/tasks/bind/github/complete/page.tsx`
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/tasks/bind/github/complete/_components/github-bind-complete-client.tsx`
- `apps/app/src/__tests__/app/api/github/github-routes.test.ts`
- `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/tasks/bind/github/complete-page.test.tsx`

Modify:

- `pnpm-workspace.yaml`
- `api/app/package.json`
- `api/app/src/env.ts`
- `api/app/src/root.ts`
- `api/app/src/__tests__/org-binding-helpers.test.ts`
- `db/app/src/index.ts`
- `db/app/src/utils/org-binding.ts`
- `apps/app/package.json`
- `apps/app/src/proxy.ts`
- `apps/app/src/__tests__/proxy.test.ts`
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/tasks/bind/page.tsx`
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/tasks/bind/_components/bind-github-card.tsx`
- `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/tasks/bind/page.test.tsx`
- `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/tasks/bind/bind-github-card.test.tsx`

Generate:

- `patches/@emulators__core@0.6.0.patch`
- `patches/emulate@0.6.0.patch`
- `pnpm-lock.yaml`

Do not modify:

- `db/app/src/schema/tables/org-source-control-bindings.ts`
- Any migration SQL file
- Production webhook routes

---

### Task 1: Add Emulator Package Skeleton And Dependency Patch

**Files:**
- Create: `emulators/github/package.json`
- Create: `emulators/github/tsconfig.json`
- Create: `emulators/github/vitest.config.ts`
- Modify: `pnpm-workspace.yaml`
- Generate: `patches/@emulators__core@0.6.0.patch`
- Generate: `patches/emulate@0.6.0.patch`
- Generate: `pnpm-lock.yaml`

- [ ] **Step 1: Create the emulator package manifest**

Create `emulators/github/package.json`:

```json
{
  "name": "@repo/github-emulator",
  "version": "0.1.0",
  "private": true,
  "license": "Apache-2.0",
  "type": "module",
  "sideEffects": false,
  "scripts": {
    "clean": "git clean -xdf .cache .turbo node_modules",
    "dev": "tsx ./src/start.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@emulators/core": "0.6.0",
    "@emulators/github": "0.6.0",
    "@repo/typescript-config": "workspace:*",
    "@repo/vitest-config": "workspace:*",
    "@types/node": "catalog:",
    "emulate": "0.6.0",
    "jose": "catalog:",
    "tsx": "^4.21.0",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

- [ ] **Step 2: Create TypeScript config**

Create `emulators/github/tsconfig.json`:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "lib": ["ES2022", "dom", "dom.iterable"]
  },
  "include": ["src"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create Vitest config**

Create `emulators/github/vitest.config.ts`:

```ts
import sharedConfig from "@repo/vitest-config";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      globals: true,
      environment: "node",
    },
  })
);
```

- [ ] **Step 4: Install workspace dependencies**

Run:

```bash
pnpm install
```

Expected: `pnpm-lock.yaml` records `emulate@0.6.0`, `@emulators/github@0.6.0`, and `@emulators/core@0.6.0`.

- [ ] **Step 5: Patch `@emulators/core` JWT verification**

Run:

```bash
pnpm patch @emulators/core@0.6.0
```

In the opened patch directory, edit `dist/index.js`.

Replace:

```js
import { jwtVerify, importPKCS8 } from "jose";
```

with:

```js
import { createPublicKey } from "node:crypto";
import { jwtVerify } from "jose";
```

Replace:

```js
const key = await importPKCS8(appInfo.privateKey, "RS256");
await jwtVerify(token, key, { algorithms: ["RS256"] });
```

with:

```js
const key = createPublicKey(appInfo.privateKey);
await jwtVerify(token, key, { algorithms: ["RS256"] });
```

Commit the patch with `pnpm patch-commit` followed by the exact directory path printed by `pnpm patch`.

Expected: `pnpm-workspace.yaml` contains a new `patchedDependencies` entry for `@emulators/core@0.6.0`.

- [ ] **Step 6: Patch bundled `emulate` JWT verification**

Run:

```bash
pnpm patch emulate@0.6.0
```

In the opened patch directory, edit `dist/index.js` and `dist/api.js`.

In both files, replace:

```js
import {
  importPKCS8,
  jwtVerify
} from "./chunk-D6EKRYGP.js";
```

with:

```js
import {
  jwtVerify
} from "./chunk-D6EKRYGP.js";
```

In both files, replace:

```js
import { createHmac } from "crypto";
```

with:

```js
import { createHmac, createPublicKey } from "crypto";
```

In both files, replace:

```js
const key = await importPKCS8(appInfo.privateKey, "RS256");
await jwtVerify(token, key, { algorithms: ["RS256"] });
```

with:

```js
const key = createPublicKey(appInfo.privateKey);
await jwtVerify(token, key, { algorithms: ["RS256"] });
```

Commit the patch with `pnpm patch-commit` followed by the exact directory path printed by `pnpm patch`.

Expected: `pnpm-workspace.yaml` contains a new `patchedDependencies` entry for `emulate@0.6.0`.

- [ ] **Step 7: Run the skeleton package checks**

Run:

```bash
pnpm --filter @repo/github-emulator typecheck
pnpm --filter @repo/github-emulator test
```

Expected: typecheck passes, and Vitest exits with "No test files found" only if no test exists yet. If Vitest exits non-zero because no tests exist, continue after Task 2 adds tests.

- [ ] **Step 8: Commit**

```bash
git add emulators/github/package.json emulators/github/tsconfig.json emulators/github/vitest.config.ts pnpm-workspace.yaml pnpm-lock.yaml patches
git commit -m "chore: add github emulator workspace package"
```

---

### Task 2: Build The Dev GitHub Emulator Harness

**Files:**
- Create: `emulators/github/src/fixtures.ts`
- Create: `emulators/github/src/server.ts`
- Create: `emulators/github/src/start.ts`
- Create: `emulators/github/src/__tests__/server.test.ts`
- Create: `emulators/github/README.md`

- [ ] **Step 1: Write the failing emulator server test**

Create `emulators/github/src/__tests__/server.test.ts`:

```ts
import { SignJWT, importPKCS8 } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  GITHUB_EMULATOR_FIXTURES,
  getGitHubEmulatorEnv,
} from "../fixtures";
import {
  startGitHubEmulator,
  type StartedGitHubEmulator,
} from "../server";

let emulator: StartedGitHubEmulator;

async function createAppJwt() {
  const key = await importPKCS8(
    GITHUB_EMULATOR_FIXTURES.githubAppPrivateKey,
    "RS256"
  );
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt(now - 30)
    .setExpirationTime(now + 9 * 60)
    .setIssuer(String(GITHUB_EMULATOR_FIXTURES.githubAppId))
    .sign(key);
}

beforeAll(async () => {
  emulator = await startGitHubEmulator({ port: 4567 });
});

afterAll(async () => {
  await emulator.close();
});

describe("@repo/github-emulator", () => {
  it("starts a seeded GitHub emulator on the fixed local origin", async () => {
    expect(emulator.url).toBe("http://127.0.0.1:4567");

    const res = await fetch(`${emulator.url}/orgs/lightfast-emulated`);
    await expect(res.json()).resolves.toMatchObject({
      login: "lightfast-emulated",
      name: "Lightfast Emulated",
    });
  });

  it("seeds the OAuth user as a member of the GitHub org", async () => {
    const token = "test_token_lightfast";
    const res = await fetch(`${emulator.url}/user/orgs`, {
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ login: "lightfast-emulated" }),
      ])
    );
  });

  it("accepts a valid GitHub App JWT after the local patch", async () => {
    const jwt = await createAppJwt();
    const res = await fetch(`${emulator.url}/app`, {
      headers: { authorization: `Bearer ${jwt}` },
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      id: GITHUB_EMULATOR_FIXTURES.githubAppId,
      slug: GITHUB_EMULATOR_FIXTURES.githubAppSlug,
    });
  });

  it("mints installation tokens for the seeded org installation", async () => {
    const jwt = await createAppJwt();
    const res = await fetch(
      `${emulator.url}/app/installations/${GITHUB_EMULATOR_FIXTURES.installationId}/access_tokens`,
      {
        method: "POST",
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${jwt}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      }
    );

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toMatchObject({
      repository_selection: "all",
      token: expect.stringMatching(/^ghs_/),
    });
  });

  it("prints the env values consumed by app and api packages", () => {
    expect(getGitHubEmulatorEnv("https://app.lightfast.localhost")).toEqual(
      expect.objectContaining({
        GITHUB_APP_ID: String(GITHUB_EMULATOR_FIXTURES.githubAppId),
        GITHUB_APP_SLUG: GITHUB_EMULATOR_FIXTURES.githubAppSlug,
        GITHUB_INSTALL_URL_OVERRIDE:
          "https://app.lightfast.localhost/api/dev/github/install?emulator_origin=http%3A%2F%2F127.0.0.1%3A4567&installation_id=1001&provider_account_login=lightfast-emulated",
      })
    );
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
pnpm --filter @repo/github-emulator test -- src/__tests__/server.test.ts
```

Expected: FAIL because `../fixtures` and `../server` do not exist.

- [ ] **Step 3: Add deterministic fixtures**

Create `emulators/github/src/fixtures.ts`:

```ts
import type { GitHubSeedConfig } from "@emulators/github";

const githubAppPrivateKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEAouLr+xRpS3PjnON4PW2cgwUUmRpZWBKy22PJrBIJ58MFG9T6
zWcYQlEsxAuKvVSrPLZLcox2cJqySdEeWgXTc4QpAS8S1UMhCUyyHWeWcwwnfvTE
vDM7+oA0nqdry4Ij9N3/mlTFPLyUGCdq6BjBlHFSbb35QvhooauTY2HUDdejmZna
/oi8FlQQOUwxcaG5Uxub8S8z8WENMlAyYffCsZwAJEJFnhE2N2fJJh3zLVDH8tQv
Ze4zvvZ/vobWzNWpwAF1UWr+4+sW4YANiAmNeFWXiRS6caEP35HWYJURWB0AX8xH
kC+86kJ5N9Pi9NJxEZHUJM2M1Pb5Ndnqe4LtKwIDAQABAoIBAFRJB8MMdM/OT+FG
81kV9v71CguPTtv8EQDlSd34F5gNmf8k3gKbbjoitv9a2ZfO0CzCR5gmhsMNyWPZ
CdObYCdOI8mxChXAfr/JKAF/MKKnj2hqT8Ly3/5niNLv3x+XX/O9TB4X71fWXOuC
uhcPeFvPp8+RlgHJeJrvpXyvioL+VshODkPu172ZUzDmYQq2MpU+5h8Cl2P7v/Lu
UBXldyHC7NV3lSnWBOQo0wHJuBRhc/SGs4gQikdM1lsNQzpAfklKVve+diwq3cFS
SlywPv9+pyneqFJaOKDKcX2pQPCUppZct93u5TdZlq2mcyksonkVjzraQcOFqe7c
v3YRV4ECgYEA1+qZTklBNG9EKM3GDzLlD2JuY7howGade/mamdfbJF2ZLimEdr1a
OVK49s791wdcvy9HrVGWRoCR6XCnLRipcS7nagjyov9sKuUyHca+MMwGhtBoZUvo
vKGe+tIcEXN0Dx2V7Uf4TKjZV4KEbwKsI9k8oszCaKKSKpe4c3PKS8kCgYEAwSAU
P4M8kj97hA8c6ryowUkjn0QArlBXb8ZHx/m75MAoJyDvnIAf5c6oPsivtQOEut+7
T6lramBW9NFhGFhJ/W4R46aE76alnkpUfc3Gl+tQpUfgy96eslYFj9MeAAAJF5Wm
B7TuR85vIBVazOfS/nyTNmnogI1ogpxjqrRBA1MCgYAaZ++N2nml/wGX9+qEC1Zm
NkSH35K4DRSvh8w3imWbofLM6XjwyKGTJyHF1XTH6neWTiL2+GZnguvVX9iiNETs
ua7FkgiSlKhW6qbha1/xOdKGhFBwKwNwpld6F14laDhGbPjcBxQ/09qY0DaAGRSS
Ycv/oQkZoOA9Y0bEn+GauQKBgQCMIHqQmuiYNPeqGk0hBUJs/GScavsTf7fxoizz
LIDouYRo37z8EPsUA56P742OCb+E2FFQu9z0knKFsGaDA4ysFfFk/K34NTJ2Z/hm
T6iJEnSxeDXjtuPvAfuHH+fkmCIAutR9Qwqhj2eSH+yCQLMXc8xc7vuESxZJrq+i
bKe/gQKBgGo3znkV7ciSGu6IKaOc14C6QzMFY1AJo0CvpK3lPXg90lq5Qc9YlJKZ
2Nu8V5rwDRADT5aHUCAHmsUMAHsSgz0q/vQGScrVGXx9t7lgJtCQqeQAgvP6mkES
cjljNGHUA1K2apyhpQxvm6BtdXY3ZDIMXLav6ZbUtvjZibC9cDNb
-----END RSA PRIVATE KEY-----`;

export const GITHUB_EMULATOR_FIXTURES = {
  origin: "http://127.0.0.1:4567",
  githubUserLogin: "lightfast-dev",
  githubUserEmail: "lightfast-dev@example.test",
  githubOrgLogin: "lightfast-emulated",
  githubRepoName: "workspace",
  oauthClientId: "Iv1.lightfastlocal",
  oauthClientSecret: "lightfast-local-secret",
  githubAppId: 424242,
  githubAppSlug: "lightfast-local",
  githubAppName: "Lightfast Local",
  githubAppPrivateKey: githubAppPrivateKey.trim(),
  githubWebhookSecret: "lightfast-local-webhook-secret",
  installationId: 1001,
  userToken: "test_token_lightfast",
} as const;

export function createGitHubEmulatorSeed(): GitHubSeedConfig {
  return {
    users: [
      {
        login: GITHUB_EMULATOR_FIXTURES.githubUserLogin,
        name: "Lightfast Dev",
        email: GITHUB_EMULATOR_FIXTURES.githubUserEmail,
      },
    ],
    orgs: [
      {
        login: GITHUB_EMULATOR_FIXTURES.githubOrgLogin,
        name: "Lightfast Emulated",
        email: "engineering@example.test",
      },
    ],
    tokens: {
      [GITHUB_EMULATOR_FIXTURES.userToken]: {
        login: GITHUB_EMULATOR_FIXTURES.githubUserLogin,
        scopes: ["repo", "user", "read:org", "admin:org"],
      },
    },
    repos: [
      {
        owner: GITHUB_EMULATOR_FIXTURES.githubOrgLogin,
        name: GITHUB_EMULATOR_FIXTURES.githubRepoName,
        private: true,
        language: "TypeScript",
        auto_init: true,
      },
    ],
    oauth_apps: [
      {
        client_id: GITHUB_EMULATOR_FIXTURES.oauthClientId,
        client_secret: GITHUB_EMULATOR_FIXTURES.oauthClientSecret,
        name: "Lightfast Local OAuth",
        redirect_uris: [
          "https://app.lightfast.localhost/api/github/oauth/callback",
        ],
      },
    ],
    apps: [
      {
        app_id: GITHUB_EMULATOR_FIXTURES.githubAppId,
        slug: GITHUB_EMULATOR_FIXTURES.githubAppSlug,
        name: GITHUB_EMULATOR_FIXTURES.githubAppName,
        private_key: GITHUB_EMULATOR_FIXTURES.githubAppPrivateKey,
        webhook_secret: GITHUB_EMULATOR_FIXTURES.githubWebhookSecret,
        permissions: {
          contents: "read",
          issues: "read",
          metadata: "read",
          pull_requests: "read",
        },
        events: ["issues", "pull_request", "push"],
        installations: [
          {
            installation_id: GITHUB_EMULATOR_FIXTURES.installationId,
            account: GITHUB_EMULATOR_FIXTURES.githubOrgLogin,
            repository_selection: "all",
          },
        ],
      },
    ],
  };
}

export function getGitHubEmulatorEnv(appOrigin: string) {
  const installUrl = new URL("/api/dev/github/install", appOrigin);
  installUrl.searchParams.set("emulator_origin", GITHUB_EMULATOR_FIXTURES.origin);
  installUrl.searchParams.set(
    "installation_id",
    String(GITHUB_EMULATOR_FIXTURES.installationId)
  );
  installUrl.searchParams.set(
    "provider_account_login",
    GITHUB_EMULATOR_FIXTURES.githubOrgLogin
  );

  return {
    GITHUB_APP_ID: String(GITHUB_EMULATOR_FIXTURES.githubAppId),
    GITHUB_APP_SLUG: GITHUB_EMULATOR_FIXTURES.githubAppSlug,
    GITHUB_API_VERSION: "2022-11-28",
    GITHUB_APP_CLIENT_ID: GITHUB_EMULATOR_FIXTURES.oauthClientId,
    GITHUB_APP_CLIENT_SECRET: GITHUB_EMULATOR_FIXTURES.oauthClientSecret,
    GITHUB_APP_PRIVATE_KEY:
      GITHUB_EMULATOR_FIXTURES.githubAppPrivateKey.replace(/\n/g, "\\n"),
    GITHUB_APP_WEBHOOK_SECRET: GITHUB_EMULATOR_FIXTURES.githubWebhookSecret,
    GITHUB_INSTALL_URL_OVERRIDE: installUrl.toString(),
  };
}
```

- [ ] **Step 4: Add the programmatic emulator server**

Create `emulators/github/src/server.ts`:

```ts
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

function addOrgMembership(store: Parameters<typeof getGitHubStore>[0]) {
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

  return {
    url,
    reset: seed,
    close: () =>
      new Promise((resolve, reject) => {
        httpServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
}
```

- [ ] **Step 5: Add a start script that prints env values**

Create `emulators/github/src/start.ts`:

```ts
import { getGitHubEmulatorEnv } from "./fixtures";
import { startGitHubEmulator } from "./server";

const port = Number.parseInt(process.env.PORT ?? "4567", 10);
const appOrigin =
  process.env.LIGHTFAST_APP_ORIGIN ?? "https://app.lightfast.localhost";

const emulator = await startGitHubEmulator({ port });
const env = getGitHubEmulatorEnv(appOrigin);

console.log(`[github-emulator] listening on ${emulator.url}`);
console.log("[github-emulator] add these values to apps/app/.vercel/.env.development.local:");
for (const [key, value] of Object.entries(env)) {
  console.log(`${key}=${JSON.stringify(value)}`);
}

const shutdown = async () => {
  await emulator.close();
  process.exit(0);
};

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
```

- [ ] **Step 6: Add the local runbook**

Create `emulators/github/README.md`:

```md
# GitHub Emulator

This package starts a dev-only GitHub emulator for the Lightfast GitHub org binding flow.

Run:

```bash
pnpm --filter @repo/github-emulator dev
```

The script prints the GitHub App environment values expected by `api/app`. Copy those values into `apps/app/.vercel/.env.development.local`, then run the normal root dev server:

```bash
pnpm dev
```

The local install override starts at:

```text
https://app.lightfast.localhost/api/dev/github/install
```

The dev shim redirects into the normal Lightfast callback flow with the pre-seeded installation id. The emulator owns only local development and integration tests; production runtime code must not import this package.
```

- [ ] **Step 7: Run emulator tests**

Run:

```bash
pnpm --filter @repo/github-emulator test -- src/__tests__/server.test.ts
pnpm --filter @repo/github-emulator typecheck
```

Expected: PASS. If the JWT test fails with "A JSON web token could not be decoded", revisit Task 1 patching before continuing.

- [ ] **Step 8: Commit**

```bash
git add emulators/github
git commit -m "test: add github emulator harness"
```

---

### Task 3: Add GitHub Contract And Node Helper Packages

**Files:**
- Create: `packages/github-app-contract/*`
- Create: `packages/github-app-node/*`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Write contract tests**

Create `packages/github-app-contract/src/__tests__/github-app.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  GITHUB_BIND_ERROR_CODES,
  GITHUB_OAUTH_CALLBACK_PATH,
  GITHUB_SETUP_PATH,
  githubBindStartOutputSchema,
  githubNormalizedInstallationSchema,
} from "../github-app";

describe("@repo/github-app-contract", () => {
  it("exports stable callback route constants", () => {
    expect(GITHUB_SETUP_PATH).toBe("/api/github/setup");
    expect(GITHUB_OAUTH_CALLBACK_PATH).toBe("/api/github/oauth/callback");
  });

  it("validates client-safe start output", () => {
    expect(
      githubBindStartOutputSchema.parse({
        installationUrl:
          "https://app.lightfast.localhost/api/dev/github/install?state=abc",
      })
    ).toEqual({
      installationUrl:
        "https://app.lightfast.localhost/api/dev/github/install?state=abc",
    });
  });

  it("keeps bind error codes compact", () => {
    expect(GITHUB_BIND_ERROR_CODES).toContain("expired_state");
    expect(GITHUB_BIND_ERROR_CODES).toContain("installation_not_verified");
    expect(GITHUB_BIND_ERROR_CODES).toContain("org_already_bound");
  });

  it("normalizes organization installations only when account metadata is present", () => {
    expect(
      githubNormalizedInstallationSchema.parse({
        appId: "424242",
        appSlug: "lightfast-local",
        events: ["issues"],
        id: "1001",
        permissions: { contents: "read" },
        repositorySelection: "all",
        targetType: "Organization",
        account: {
          id: "123",
          login: "lightfast-emulated",
          type: "Organization",
        },
      })
    ).toMatchObject({
      account: { login: "lightfast-emulated" },
      id: "1001",
      targetType: "Organization",
    });
  });
});
```

- [ ] **Step 2: Create contract package**

Create `packages/github-app-contract/package.json`:

```json
{
  "name": "@repo/github-app-contract",
  "version": "0.1.0",
  "private": true,
  "license": "Apache-2.0",
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "scripts": {
    "clean": "git clean -xdf .cache .turbo node_modules",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "catalog:"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@repo/vitest-config": "workspace:*",
    "@types/node": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

Create `packages/github-app-contract/tsconfig.json`:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "lib": ["ES2022", "dom", "dom.iterable"]
  },
  "include": ["src"],
  "exclude": ["node_modules"]
}
```

Create `packages/github-app-contract/vitest.config.ts`:

```ts
import sharedConfig from "@repo/vitest-config";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      globals: true,
      environment: "node",
    },
  })
);
```

Create `packages/github-app-contract/src/github-app.ts`:

```ts
import { z } from "zod";

export const GITHUB_SETUP_PATH = "/api/github/setup";
export const GITHUB_OAUTH_CALLBACK_PATH = "/api/github/oauth/callback";
export const GITHUB_WEBHOOK_PATH = "/api/github/webhook";
export const GITHUB_DEV_INSTALL_PATH = "/api/dev/github/install";

export const GITHUB_BIND_ERROR_CODES = [
  "expired_state",
  "installation_not_verified",
  "personal_account_not_supported",
  "permission_required",
  "installation_already_bound",
  "org_already_bound",
  "saml_session_required",
  "github_authorization_denied",
  "github_transient_error",
] as const;

export const githubBindErrorCodeSchema = z.enum(GITHUB_BIND_ERROR_CODES);
export type GitHubBindErrorCode = z.infer<typeof githubBindErrorCodeSchema>;

export const githubBindStartOutputSchema = z.object({
  installationUrl: z.string().url(),
});
export type GitHubBindStartOutput = z.infer<
  typeof githubBindStartOutputSchema
>;

export const githubNormalizedInstallationSchema = z.object({
  account: z.object({
    id: z.string().min(1),
    login: z.string().min(1),
    type: z.enum(["Organization", "User"]),
  }),
  appId: z.string().min(1),
  appSlug: z.string().min(1).nullable(),
  events: z.array(z.string()),
  id: z.string().min(1),
  permissions: z.record(z.string(), z.string()),
  repositorySelection: z.enum(["all", "selected"]),
  suspendedAt: z.string().nullable().optional(),
  targetType: z.enum(["Organization", "User"]),
});
export type GitHubNormalizedInstallation = z.infer<
  typeof githubNormalizedInstallationSchema
>;

export const githubInstallationMetadataSchema = z.object({
  events: z.array(z.string()),
  githubAppId: z.string().min(1),
  githubAppSlug: z.string().min(1).nullable(),
  githubSetupAction: z.string().min(1).optional(),
  permissions: z.record(z.string(), z.string()),
  repositorySelection: z.enum(["all", "selected"]),
  verifiedBy: z.enum(["github_emulator", "github_user_installations"]),
});
export type GitHubInstallationMetadata = z.infer<
  typeof githubInstallationMetadataSchema
>;
```

Create `packages/github-app-contract/src/index.ts`:

```ts
export {
  GITHUB_BIND_ERROR_CODES,
  GITHUB_DEV_INSTALL_PATH,
  GITHUB_OAUTH_CALLBACK_PATH,
  GITHUB_SETUP_PATH,
  GITHUB_WEBHOOK_PATH,
  type GitHubBindErrorCode,
  type GitHubBindStartOutput,
  type GitHubInstallationMetadata,
  type GitHubNormalizedInstallation,
  githubBindErrorCodeSchema,
  githubBindStartOutputSchema,
  githubInstallationMetadataSchema,
  githubNormalizedInstallationSchema,
} from "./github-app";
```

- [ ] **Step 3: Write node helper tests**

Create focused tests:

`packages/github-app-node/src/__tests__/pkce.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createGitHubPkcePair } from "../pkce";

describe("createGitHubPkcePair", () => {
  it("creates a S256 verifier and challenge", () => {
    const pair = createGitHubPkcePair();
    expect(pair.codeChallengeMethod).toBe("S256");
    expect(pair.codeVerifier).toMatch(/^[A-Za-z0-9_-]{43,}$/);
    expect(pair.codeChallenge).toMatch(/^[A-Za-z0-9_-]{43,}$/);
  });
});
```

`packages/github-app-node/src/__tests__/urls.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildGitHubInstallationUrl,
  buildGitHubOAuthAuthorizeUrl,
} from "../urls";

describe("GitHub URL builders", () => {
  it("appends state to the dev install override", () => {
    expect(
      buildGitHubInstallationUrl({
        appSlug: "lightfast-local",
        installUrlOverride:
          "https://app.lightfast.localhost/api/dev/github/install?installation_id=1001",
        state: "state_123",
      })
    ).toBe(
      "https://app.lightfast.localhost/api/dev/github/install?installation_id=1001&state=state_123"
    );
  });

  it("builds a GitHub App installation URL when no override is provided", () => {
    expect(
      buildGitHubInstallationUrl({
        appSlug: "lightfast-local",
        state: "state_123",
      })
    ).toBe(
      "https://github.com/apps/lightfast-local/installations/new?state=state_123"
    );
  });

  it("builds an OAuth authorize URL against an emulator origin", () => {
    const url = new URL(
      buildGitHubOAuthAuthorizeUrl({
        authorizationBaseUrl: "http://127.0.0.1:4567/login/oauth/authorize",
        clientId: "Iv1.lightfastlocal",
        codeChallenge: "challenge",
        redirectUri: "https://app.lightfast.localhost/api/github/oauth/callback",
        state: "state_456",
      })
    );

    expect(url.origin + url.pathname).toBe(
      "http://127.0.0.1:4567/login/oauth/authorize"
    );
    expect(url.searchParams.get("client_id")).toBe("Iv1.lightfastlocal");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });
});
```

`packages/github-app-node/src/__tests__/emulator-verifier.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { verifyGitHubEmulatorInstallation } from "../emulator-verifier";

describe("verifyGitHubEmulatorInstallation", () => {
  it("verifies a matching org installation through emulator-supported endpoints", async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      const pathname = new URL(url).pathname;
      if (pathname === "/user") {
        return Response.json({ id: 10, login: "lightfast-dev" });
      }
      if (pathname === "/user/orgs") {
        return Response.json([{ id: 20, login: "lightfast-emulated" }]);
      }
      if (pathname === "/orgs/lightfast-emulated/installation") {
        return Response.json({
          id: 1001,
          account: {
            id: 20,
            login: "lightfast-emulated",
            type: "Organization",
          },
          app_id: 424242,
          app_slug: "lightfast-local",
          events: ["issues"],
          permissions: { contents: "read" },
          repository_selection: "all",
          suspended_at: null,
          target_type: "Organization",
        });
      }
      return Response.json({ message: "Not Found" }, { status: 404 });
    });

    await expect(
      verifyGitHubEmulatorInstallation({
        emulatorOrigin: "http://127.0.0.1:4567",
        expectedInstallationId: "1001",
        expectedOrgLogin: "lightfast-emulated",
        fetch: fetchMock,
        userAccessToken: "gho_test",
      })
    ).resolves.toMatchObject({
      account: { login: "lightfast-emulated", type: "Organization" },
      id: "1001",
      targetType: "Organization",
    });
  });

  it("rejects an inaccessible org installation", async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      const pathname = new URL(url).pathname;
      if (pathname === "/user") {
        return Response.json({ id: 10, login: "lightfast-dev" });
      }
      if (pathname === "/user/orgs") {
        return Response.json([]);
      }
      return Response.json({ message: "Not Found" }, { status: 404 });
    });

    await expect(
      verifyGitHubEmulatorInstallation({
        emulatorOrigin: "http://127.0.0.1:4567",
        expectedInstallationId: "1001",
        expectedOrgLogin: "lightfast-emulated",
        fetch: fetchMock,
        userAccessToken: "gho_test",
      })
    ).rejects.toMatchObject({ code: "INSTALLATION_NOT_VERIFIED" });
  });
});
```

- [ ] **Step 4: Create node helper package**

Create `packages/github-app-node/package.json`:

```json
{
  "name": "@repo/github-app-node",
  "version": "0.1.0",
  "private": true,
  "license": "Apache-2.0",
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "scripts": {
    "clean": "git clean -xdf .cache .turbo node_modules",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@repo/github-app-contract": "workspace:*",
    "jose": "catalog:",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@repo/vitest-config": "workspace:*",
    "@types/node": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

Create `packages/github-app-node/tsconfig.json`:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "lib": ["ES2022", "dom", "dom.iterable"]
  },
  "include": ["src"],
  "exclude": ["node_modules"]
}
```

Create `packages/github-app-node/vitest.config.ts`:

```ts
import sharedConfig from "@repo/vitest-config";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      globals: true,
      environment: "node",
    },
  })
);
```

- [ ] **Step 5: Implement helper files**

Create `packages/github-app-node/src/errors.ts`:

```ts
export type GitHubAppNodeErrorCode =
  | "GITHUB_OAUTH_EXCHANGE_FAILED"
  | "INSTALLATION_NOT_VERIFIED"
  | "PERSONAL_ACCOUNT_NOT_SUPPORTED";

export class GitHubAppNodeError extends Error {
  constructor(
    readonly code: GitHubAppNodeErrorCode,
    message: string
  ) {
    super(message);
    this.name = "GitHubAppNodeError";
  }
}
```

Create `packages/github-app-node/src/pkce.ts`:

```ts
import { createHash, randomBytes } from "node:crypto";

function base64url(bytes: Buffer): string {
  return bytes.toString("base64url");
}

export interface GitHubPkcePair {
  codeChallenge: string;
  codeChallengeMethod: "S256";
  codeVerifier: string;
}

export function createGitHubPkcePair(): GitHubPkcePair {
  const codeVerifier = base64url(randomBytes(32));
  const codeChallenge = base64url(
    createHash("sha256").update(codeVerifier).digest()
  );
  return { codeChallenge, codeChallengeMethod: "S256", codeVerifier };
}
```

Create `packages/github-app-node/src/urls.ts`:

```ts
export function buildGitHubInstallationUrl(input: {
  appSlug: string;
  installUrlOverride?: string | null;
  state: string;
}): string {
  const url = input.installUrlOverride
    ? new URL(input.installUrlOverride)
    : new URL(`https://github.com/apps/${input.appSlug}/installations/new`);
  url.searchParams.set("state", input.state);
  return url.toString();
}

export function buildGitHubOAuthAuthorizeUrl(input: {
  authorizationBaseUrl?: string;
  clientId: string;
  codeChallenge: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(
    input.authorizationBaseUrl ?? "https://github.com/login/oauth/authorize"
  );
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}
```

Create `packages/github-app-node/src/oauth.ts`:

```ts
import { z } from "zod";
import { GitHubAppNodeError } from "./errors";

const githubOAuthTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().min(1),
});

export interface ExchangeGitHubOAuthCodeInput {
  clientId: string;
  clientSecret: string;
  code: string;
  codeVerifier: string;
  fetch?: typeof fetch;
  redirectUri: string;
  tokenUrl?: string;
}

export async function exchangeGitHubOAuthCode(
  input: ExchangeGitHubOAuthCodeInput
): Promise<{ accessToken: string; tokenType: string }> {
  const requestFetch = input.fetch ?? fetch;
  const res = await requestFetch(
    input.tokenUrl ?? "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        client_id: input.clientId,
        client_secret: input.clientSecret,
        code: input.code,
        code_verifier: input.codeVerifier,
        redirect_uri: input.redirectUri,
      }),
    }
  );

  const json = await res.json().catch(() => null);
  const parsed = githubOAuthTokenResponseSchema.safeParse(json);
  if (!res.ok || !parsed.success) {
    throw new GitHubAppNodeError(
      "GITHUB_OAUTH_EXCHANGE_FAILED",
      "GitHub OAuth code exchange failed."
    );
  }

  return {
    accessToken: parsed.data.access_token,
    tokenType: parsed.data.token_type,
  };
}
```

Create `packages/github-app-node/src/app-jwt.ts`:

```ts
import { SignJWT, importPKCS8 } from "jose";

export async function createGitHubAppJwt(input: {
  appId: string;
  now?: Date;
  privateKey: string;
}): Promise<string> {
  const key = await importPKCS8(input.privateKey, "RS256");
  const now = Math.floor((input.now ?? new Date()).getTime() / 1000);
  return await new SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt(now - 30)
    .setExpirationTime(now + 9 * 60)
    .setIssuer(input.appId)
    .sign(key);
}
```

Create `packages/github-app-node/src/emulator-verifier.ts` with:

```ts
import {
  type GitHubNormalizedInstallation,
  githubNormalizedInstallationSchema,
} from "@repo/github-app-contract";
import { GitHubAppNodeError } from "./errors";

interface GitHubEmulatorInstallationResponse {
  account?: {
    id?: number | string;
    login?: string;
    type?: string;
  } | null;
  app_id?: number | string;
  app_slug?: string | null;
  events?: string[];
  id?: number | string;
  permissions?: Record<string, string>;
  repository_selection?: "all" | "selected";
  suspended_at?: string | null;
  target_type?: string;
}

async function getJson(input: {
  fetch: typeof fetch;
  token: string;
  url: string;
}) {
  const res = await input.fetch(input.url, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${input.token}`,
    },
  });
  if (!res.ok) {
    throw new GitHubAppNodeError(
      "INSTALLATION_NOT_VERIFIED",
      "GitHub emulator verification request failed."
    );
  }
  return await res.json();
}

export async function verifyGitHubEmulatorInstallation(input: {
  emulatorOrigin: string;
  expectedInstallationId: string;
  expectedOrgLogin: string;
  fetch?: typeof fetch;
  userAccessToken: string;
}): Promise<GitHubNormalizedInstallation> {
  const requestFetch = input.fetch ?? fetch;
  const origin = input.emulatorOrigin.replace(/\/+$/, "");

  await getJson({
    fetch: requestFetch,
    token: input.userAccessToken,
    url: `${origin}/user`,
  });

  const orgs = await getJson({
    fetch: requestFetch,
    token: input.userAccessToken,
    url: `${origin}/user/orgs`,
  });

  const hasOrgAccess =
    Array.isArray(orgs) &&
    orgs.some(
      (org) =>
        org &&
        typeof org === "object" &&
        "login" in org &&
        org.login === input.expectedOrgLogin
    );

  if (!hasOrgAccess) {
    throw new GitHubAppNodeError(
      "INSTALLATION_NOT_VERIFIED",
      "GitHub user cannot access the expected emulator org."
    );
  }

  const rawInstallation = (await getJson({
    fetch: requestFetch,
    token: input.userAccessToken,
    url: `${origin}/orgs/${input.expectedOrgLogin}/installation`,
  })) as GitHubEmulatorInstallationResponse;

  if (String(rawInstallation.id) !== input.expectedInstallationId) {
    throw new GitHubAppNodeError(
      "INSTALLATION_NOT_VERIFIED",
      "GitHub emulator installation id did not match callback id."
    );
  }

  if (
    rawInstallation.target_type !== "Organization" ||
    rawInstallation.account?.type !== "Organization"
  ) {
    throw new GitHubAppNodeError(
      "PERSONAL_ACCOUNT_NOT_SUPPORTED",
      "Only GitHub organization installations are supported."
    );
  }

  return githubNormalizedInstallationSchema.parse({
    account: {
      id: String(rawInstallation.account.id),
      login: rawInstallation.account.login,
      type: rawInstallation.account.type,
    },
    appId: String(rawInstallation.app_id),
    appSlug: rawInstallation.app_slug ?? null,
    events: rawInstallation.events ?? [],
    id: String(rawInstallation.id),
    permissions: rawInstallation.permissions ?? {},
    repositorySelection: rawInstallation.repository_selection ?? "all",
    suspendedAt: rawInstallation.suspended_at ?? null,
    targetType: rawInstallation.target_type,
  });
}
```

Create `packages/github-app-node/src/index.ts`:

```ts
export { GitHubAppNodeError, type GitHubAppNodeErrorCode } from "./errors";
export { createGitHubAppJwt } from "./app-jwt";
export { exchangeGitHubOAuthCode } from "./oauth";
export { createGitHubPkcePair, type GitHubPkcePair } from "./pkce";
export { buildGitHubInstallationUrl, buildGitHubOAuthAuthorizeUrl } from "./urls";
export { verifyGitHubEmulatorInstallation } from "./emulator-verifier";
```

- [ ] **Step 6: Install and run package tests**

Run:

```bash
pnpm install
pnpm --filter @repo/github-app-contract test
pnpm --filter @repo/github-app-node test
pnpm --filter @repo/github-app-contract typecheck
pnpm --filter @repo/github-app-node typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/github-app-contract packages/github-app-node pnpm-lock.yaml
git commit -m "feat: add github app helper packages"
```

---

### Task 4: Add Binding Finalization Helpers In `db/app`

**Files:**
- Modify: `db/app/src/utils/org-binding.ts`
- Modify: `db/app/src/index.ts`
- Modify: `api/app/src/__tests__/org-binding-helpers.test.ts`

- [ ] **Step 1: Add failing tests for provider-installation finalization**

In `api/app/src/__tests__/org-binding-helpers.test.ts`, update the dynamic import:

```ts
const {
  finalizeActiveOrgProviderBinding,
  getActiveOrgBinding,
  getOrgBindingByProviderInstallation,
  isOrgBound,
  upsertActiveOrgBinding,
  markOrgBindingRevoked,
  OrgSourceControlBindingConflictError,
} = await import("@db/app");
```

Add tests:

```ts
describe("getOrgBindingByProviderInstallation", () => {
  it("returns the binding for a provider installation", async () => {
    const row = binding({
      providerInstallationId: "1001",
      providerAccountLogin: "lightfast-emulated",
    });
    const { db } = makeFakeDb({ selectResults: [[row]] });

    await expect(
      getOrgBindingByProviderInstallation(db, {
        provider: "github",
        providerInstallationId: "1001",
      })
    ).resolves.toEqual(row);
  });
});

describe("finalizeActiveOrgProviderBinding", () => {
  it("inserts a verified provider binding when no binding exists", async () => {
    const inserted = binding({
      id: 100,
      clerkOrgId: "org_new",
      providerAccountId: "20",
      providerAccountLogin: "lightfast-emulated",
      providerInstallationId: "1001",
      metadata: { verifiedBy: "github_emulator" },
    });
    const { db, spies } = makeFakeDb({
      insertId: 100,
      selectResults: [[], [], [inserted]],
    });

    await expect(
      finalizeActiveOrgProviderBinding(db, {
        clerkOrgId: "org_new",
        connectedByUserId: "user_1",
        metadata: { verifiedBy: "github_emulator" },
        provider: "github",
        providerAccountId: "20",
        providerAccountLogin: "lightfast-emulated",
        providerInstallationId: "1001",
      })
    ).resolves.toEqual(inserted);

    expect(spies.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        activeClerkOrgId: "org_new",
        clerkOrgId: "org_new",
        provider: "github",
        providerAccountId: "20",
        providerAccountLogin: "lightfast-emulated",
        providerInstallationId: "1001",
        status: "active",
      })
    );
  });

  it("returns an existing exact active binding idempotently", async () => {
    const existing = binding({
      clerkOrgId: "org_existing",
      providerInstallationId: "1001",
    });
    const { db, spies } = makeFakeDb({ selectResults: [[existing]] });

    await expect(
      finalizeActiveOrgProviderBinding(db, {
        clerkOrgId: "org_existing",
        connectedByUserId: "user_1",
        provider: "github",
        providerInstallationId: "1001",
      })
    ).resolves.toEqual(existing);

    expect(spies.insert).not.toHaveBeenCalled();
  });

  it("throws when the Lightfast org is already bound to another installation", async () => {
    const existing = binding({
      clerkOrgId: "org_existing",
      providerInstallationId: "2002",
    });
    const { db } = makeFakeDb({ selectResults: [[existing]] });

    await expect(
      finalizeActiveOrgProviderBinding(db, {
        clerkOrgId: "org_existing",
        connectedByUserId: "user_1",
        provider: "github",
        providerInstallationId: "1001",
      })
    ).rejects.toMatchObject({
      code: "ORG_ALREADY_BOUND",
    });
  });

  it("throws when another Lightfast org already owns the installation", async () => {
    const existingInstallation = binding({
      clerkOrgId: "org_other",
      providerInstallationId: "1001",
    });
    const { db } = makeFakeDb({
      selectResults: [[], [existingInstallation]],
    });

    await expect(
      finalizeActiveOrgProviderBinding(db, {
        clerkOrgId: "org_new",
        connectedByUserId: "user_1",
        provider: "github",
        providerInstallationId: "1001",
      })
    ).rejects.toMatchObject({
      code: "INSTALLATION_ALREADY_BOUND",
    });
  });
});
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/org-binding-helpers.test.ts
```

Expected: FAIL because the new DB helpers and conflict class are missing.

- [ ] **Step 3: Implement DB helpers**

In `db/app/src/utils/org-binding.ts`, add `or` to the Drizzle import if needed and add:

```ts
export type OrgSourceControlBindingConflictCode =
  | "ORG_ALREADY_BOUND"
  | "INSTALLATION_ALREADY_BOUND";

export class OrgSourceControlBindingConflictError extends Error {
  constructor(readonly code: OrgSourceControlBindingConflictCode) {
    super(code);
    this.name = "OrgSourceControlBindingConflictError";
  }
}

export interface GetOrgBindingByProviderInstallationInput {
  provider: OrgSourceControlBindingProvider;
  providerInstallationId: string;
}

export async function getOrgBindingByProviderInstallation(
  db: Database,
  input: GetOrgBindingByProviderInstallationInput
): Promise<OrgSourceControlBinding | undefined> {
  const [row] = await db
    .select(bindingSelection)
    .from(orgSourceControlBindings)
    .where(
      and(
        eq(orgSourceControlBindings.provider, input.provider),
        eq(
          orgSourceControlBindings.providerInstallationId,
          input.providerInstallationId
        )
      )
    )
    .limit(1);
  return row;
}

export interface FinalizeActiveOrgProviderBindingInput
  extends UpsertActiveOrgBindingInput {
  providerInstallationId: string;
}

export async function finalizeActiveOrgProviderBinding(
  db: Database,
  input: FinalizeActiveOrgProviderBindingInput
): Promise<OrgSourceControlBinding> {
  const existingActive = await getActiveOrgBinding(db, input.clerkOrgId);
  if (existingActive) {
    if (
      existingActive.provider === input.provider &&
      existingActive.providerInstallationId === input.providerInstallationId
    ) {
      return existingActive;
    }
    throw new OrgSourceControlBindingConflictError("ORG_ALREADY_BOUND");
  }

  const existingInstallation = await getOrgBindingByProviderInstallation(db, {
    provider: input.provider,
    providerInstallationId: input.providerInstallationId,
  });

  if (
    existingInstallation &&
    existingInstallation.clerkOrgId !== input.clerkOrgId
  ) {
    throw new OrgSourceControlBindingConflictError(
      "INSTALLATION_ALREADY_BOUND"
    );
  }

  if (existingInstallation && existingInstallation.status !== "active") {
    await db
      .update(orgSourceControlBindings)
      .set({
        activeClerkOrgId: input.clerkOrgId,
        connectedByUserId: input.connectedByUserId,
        metadata: input.metadata ?? {},
        providerAccountId: input.providerAccountId ?? null,
        providerAccountLogin: input.providerAccountLogin ?? null,
        providerInstallationId: input.providerInstallationId,
        revokedAt: null,
        status: "active",
      })
      .where(eq(orgSourceControlBindings.id, existingInstallation.id));

    const reactivated = await getActiveOrgBinding(db, input.clerkOrgId);
    if (reactivated) {
      return reactivated;
    }
    throw new Error(
      `Failed to reactivate provider binding for org ${input.clerkOrgId}`
    );
  }

  return await upsertActiveOrgBinding(db, input);
}
```

- [ ] **Step 4: Re-export helpers**

In `db/app/src/index.ts`, add exports:

```ts
  finalizeActiveOrgProviderBinding,
  type FinalizeActiveOrgProviderBindingInput,
  getOrgBindingByProviderInstallation,
  type GetOrgBindingByProviderInstallationInput,
  OrgSourceControlBindingConflictError,
  type OrgSourceControlBindingConflictCode,
```

- [ ] **Step 5: Run DB helper tests**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/org-binding-helpers.test.ts
pnpm --filter @db/app typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add db/app/src/utils/org-binding.ts db/app/src/index.ts api/app/src/__tests__/org-binding-helpers.test.ts
git commit -m "feat: finalize verified org provider bindings"
```

---

### Task 5: Add GitHub Config And Redis Bind Attempts

**Files:**
- Modify: `api/app/package.json`
- Modify: `api/app/src/env.ts`
- Create: `api/app/src/github/config.ts`
- Create: `api/app/src/github/bind-attempts.ts`
- Create: `api/app/src/__tests__/github-config.test.ts`
- Create: `api/app/src/__tests__/github-bind-attempts.test.ts`

- [ ] **Step 1: Add `api/app` dependencies**

In `api/app/package.json`, add:

```json
"@repo/github-app-contract": "workspace:*",
"@repo/github-app-node": "workspace:*",
```

under `dependencies`.

- [ ] **Step 2: Add env fields**

In `api/app/src/env.ts`, add server keys:

```ts
    GITHUB_API_VERSION: z.string().min(1).default("2022-11-28"),
    GITHUB_APP_CLIENT_ID: z.string().min(1).optional(),
    GITHUB_APP_CLIENT_SECRET: z.string().min(1).optional(),
    GITHUB_APP_ID: z.string().min(1).optional(),
    GITHUB_APP_PRIVATE_KEY: z.string().min(1).optional(),
    GITHUB_APP_SLUG: z.string().min(1).optional(),
    GITHUB_APP_WEBHOOK_SECRET: z.string().min(1).optional(),
    GITHUB_INSTALL_URL_OVERRIDE: z.string().url().optional(),
```

and runtime env:

```ts
    GITHUB_API_VERSION: process.env.GITHUB_API_VERSION,
    GITHUB_APP_CLIENT_ID: process.env.GITHUB_APP_CLIENT_ID,
    GITHUB_APP_CLIENT_SECRET: process.env.GITHUB_APP_CLIENT_SECRET,
    GITHUB_APP_ID: process.env.GITHUB_APP_ID,
    GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY,
    GITHUB_APP_SLUG: process.env.GITHUB_APP_SLUG,
    GITHUB_APP_WEBHOOK_SECRET: process.env.GITHUB_APP_WEBHOOK_SECRET,
    GITHUB_INSTALL_URL_OVERRIDE: process.env.GITHUB_INSTALL_URL_OVERRIDE,
```

- [ ] **Step 3: Write config tests**

Create `api/app/src/__tests__/github-config.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  parseGitHubInstallOverride,
  normalizeGitHubPrivateKey,
} from "../github/config";

describe("GitHub config", () => {
  it("normalizes escaped private key newlines", () => {
    expect(normalizeGitHubPrivateKey("a\\nb\\n")).toBe("a\nb\n");
  });

  it("parses the local dev install override context", () => {
    const override = parseGitHubInstallOverride({
      appOrigin: "https://app.lightfast.localhost",
      rawUrl:
        "https://app.lightfast.localhost/api/dev/github/install?emulator_origin=http%3A%2F%2F127.0.0.1%3A4567&installation_id=1001&provider_account_login=lightfast-emulated",
      vercelEnv: "development",
    });

    expect(override).toMatchObject({
      emulatorOrigin: "http://127.0.0.1:4567",
      installationId: "1001",
      providerAccountLogin: "lightfast-emulated",
      url: expect.stringContaining("/api/dev/github/install"),
    });
  });

  it("rejects the install override in production", () => {
    expect(() =>
      parseGitHubInstallOverride({
        appOrigin: "https://app.lightfast.ai",
        rawUrl:
          "https://app.lightfast.ai/api/dev/github/install?emulator_origin=http%3A%2F%2F127.0.0.1%3A4567&installation_id=1001&provider_account_login=lightfast-emulated",
        vercelEnv: "production",
      })
    ).toThrow(/not allowed in production/);
  });
});
```

- [ ] **Step 4: Implement config helpers**

Create `api/app/src/github/config.ts`:

```ts
import { GITHUB_DEV_INSTALL_PATH } from "@repo/github-app-contract";
import { env } from "../env";

export interface GitHubInstallOverride {
  emulatorOrigin: string;
  installationId: string;
  providerAccountLogin: string;
  url: string;
}

export function normalizeGitHubPrivateKey(value: string): string {
  return value.replace(/\\n/g, "\n");
}

export function parseGitHubInstallOverride(input: {
  appOrigin: string;
  rawUrl: string | undefined;
  vercelEnv: "development" | "preview" | "production";
}): GitHubInstallOverride | null {
  if (!input.rawUrl) {
    return null;
  }
  if (input.vercelEnv === "production") {
    throw new Error("GITHUB_INSTALL_URL_OVERRIDE is not allowed in production.");
  }

  const url = new URL(input.rawUrl);
  const appOrigin = new URL(input.appOrigin);
  if (url.origin !== appOrigin.origin || url.pathname !== GITHUB_DEV_INSTALL_PATH) {
    throw new Error("GITHUB_INSTALL_URL_OVERRIDE must point at the app dev install shim.");
  }

  const emulatorOrigin = url.searchParams.get("emulator_origin");
  const installationId = url.searchParams.get("installation_id");
  const providerAccountLogin = url.searchParams.get("provider_account_login");
  if (!(emulatorOrigin && installationId && providerAccountLogin)) {
    throw new Error("GITHUB_INSTALL_URL_OVERRIDE is missing emulator context.");
  }

  return {
    emulatorOrigin: new URL(emulatorOrigin).origin,
    installationId,
    providerAccountLogin,
    url: url.toString(),
  };
}

export function getGitHubEmulatorConfig(input: { appOrigin: string }) {
  const override = parseGitHubInstallOverride({
    appOrigin: input.appOrigin,
    rawUrl: env.GITHUB_INSTALL_URL_OVERRIDE,
    vercelEnv: env.VERCEL_ENV,
  });

  if (!override) {
    throw new Error(
      "The emulator slice requires GITHUB_INSTALL_URL_OVERRIDE in non-production."
    );
  }

  if (
    !(
      env.GITHUB_APP_ID &&
      env.GITHUB_APP_SLUG &&
      env.GITHUB_APP_CLIENT_ID &&
      env.GITHUB_APP_CLIENT_SECRET &&
      env.GITHUB_APP_PRIVATE_KEY
    )
  ) {
    throw new Error("GitHub App emulator environment is incomplete.");
  }

  return {
    apiVersion: env.GITHUB_API_VERSION,
    appId: env.GITHUB_APP_ID,
    appSlug: env.GITHUB_APP_SLUG,
    clientId: env.GITHUB_APP_CLIENT_ID,
    clientSecret: env.GITHUB_APP_CLIENT_SECRET,
    installOverride: override,
    privateKey: normalizeGitHubPrivateKey(env.GITHUB_APP_PRIVATE_KEY),
  };
}
```

- [ ] **Step 5: Write bind attempt tests**

Create `api/app/src/__tests__/github-bind-attempts.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const redisSetMock = vi.fn();
const redisGetdelMock = vi.fn();
const nanoidMock = vi.fn();

vi.mock("@vendor/upstash", () => ({
  redis: {
    getdel: redisGetdelMock,
    set: redisSetMock,
  },
}));

vi.mock("@vendor/lib", () => ({
  nanoid: nanoidMock,
}));

const {
  consumeGitHubInstallAttempt,
  consumeGitHubOAuthAttempt,
  issueGitHubInstallAttempt,
  issueGitHubOAuthAttempt,
} = await import("../github/bind-attempts");

beforeEach(() => {
  redisSetMock.mockReset();
  redisGetdelMock.mockReset();
  nanoidMock.mockReset();
  nanoidMock.mockReturnValue("attempt_123456789012345678901234");
});

describe("github bind attempts", () => {
  it("issues and consumes an install attempt with hashed state", async () => {
    const issued = await issueGitHubInstallAttempt({
      clerkOrgId: "org_1",
      emulator: {
        emulatorOrigin: "http://127.0.0.1:4567",
        installationId: "1001",
        providerAccountLogin: "lightfast-emulated",
      },
      lightfastUserId: "user_1",
      orgSlug: "acme",
    });
    const record = redisSetMock.mock.calls[0]?.[1];
    redisGetdelMock.mockResolvedValueOnce(record);

    await expect(
      consumeGitHubInstallAttempt({ state: issued.state })
    ).resolves.toMatchObject({
      clerkOrgId: "org_1",
      orgSlug: "acme",
      emulator: { installationId: "1001" },
    });

    expect(redisSetMock).toHaveBeenCalledWith(
      "github-bind-install-attempt:attempt_123456789012345678901234",
      expect.objectContaining({
        stateHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
      { ex: 900 }
    );
  });

  it("rejects tampered OAuth state", async () => {
    const issued = await issueGitHubOAuthAttempt({
      clerkOrgId: "org_1",
      codeVerifier: "verifier",
      emulator: {
        emulatorOrigin: "http://127.0.0.1:4567",
        installationId: "1001",
        providerAccountLogin: "lightfast-emulated",
      },
      lightfastUserId: "user_1",
      orgSlug: "acme",
      providerInstallationId: "1001",
    });
    const record = redisSetMock.mock.calls[0]?.[1];
    redisGetdelMock.mockResolvedValueOnce(record);

    await expect(
      consumeGitHubOAuthAttempt({
        state: Buffer.from(
          JSON.stringify({
            attemptId: issued.attemptId,
            nonce: "tampered_nonce",
          })
        ).toString("base64url"),
      })
    ).resolves.toBeNull();
  });
});
```

- [ ] **Step 6: Implement bind attempts**

Create `api/app/src/github/bind-attempts.ts`:

```ts
import { createHash } from "node:crypto";
import { nanoid } from "@vendor/lib";
import { redis } from "@vendor/upstash";
import { z } from "zod";

const INSTALL_PREFIX = "github-bind-install-attempt:";
const OAUTH_PREFIX = "github-bind-oauth-attempt:";
const TTL_SECONDS = 15 * 60;

const stateEnvelopeSchema = z.object({
  attemptId: z.string().min(16),
  nonce: z.string().min(16),
});

export interface GitHubEmulatorAttemptContext {
  emulatorOrigin: string;
  installationId: string;
  providerAccountLogin: string;
}

export interface GitHubBindInstallAttemptRecord {
  clerkOrgId: string;
  emulator: GitHubEmulatorAttemptContext;
  lightfastUserId: string;
  orgSlug: string;
  stateHash: string;
}

export interface GitHubBindOAuthAttemptRecord
  extends GitHubBindInstallAttemptRecord {
  codeVerifier: string;
  providerInstallationId: string;
}

function encodeState(input: { attemptId: string; nonce: string }): string {
  return Buffer.from(JSON.stringify(input), "utf8").toString("base64url");
}

function decodeState(state: string): { attemptId: string; nonce: string } | null {
  try {
    return stateEnvelopeSchema.parse(
      JSON.parse(Buffer.from(state, "base64url").toString("utf8"))
    );
  } catch {
    return null;
  }
}

function hashState(state: string): string {
  return createHash("sha256").update(state).digest("hex");
}

export async function issueGitHubInstallAttempt(input: {
  clerkOrgId: string;
  emulator: GitHubEmulatorAttemptContext;
  lightfastUserId: string;
  orgSlug: string;
}) {
  const attemptId = nanoid(32);
  const state = encodeState({ attemptId, nonce: nanoid(32) });
  const record: GitHubBindInstallAttemptRecord = {
    clerkOrgId: input.clerkOrgId,
    emulator: input.emulator,
    lightfastUserId: input.lightfastUserId,
    orgSlug: input.orgSlug,
    stateHash: hashState(state),
  };
  await redis.set(`${INSTALL_PREFIX}${attemptId}`, record, { ex: TTL_SECONDS });
  return { attemptId, state };
}

export async function consumeGitHubInstallAttempt(input: {
  state: string;
}): Promise<GitHubBindInstallAttemptRecord | null> {
  const envelope = decodeState(input.state);
  if (!envelope) {
    return null;
  }
  const record = await redis.getdel<GitHubBindInstallAttemptRecord>(
    `${INSTALL_PREFIX}${envelope.attemptId}`
  );
  if (!record || record.stateHash !== hashState(input.state)) {
    return null;
  }
  return record;
}

export async function issueGitHubOAuthAttempt(input: {
  clerkOrgId: string;
  codeVerifier: string;
  emulator: GitHubEmulatorAttemptContext;
  lightfastUserId: string;
  orgSlug: string;
  providerInstallationId: string;
}) {
  const attemptId = nanoid(32);
  const state = encodeState({ attemptId, nonce: nanoid(32) });
  const record: GitHubBindOAuthAttemptRecord = {
    clerkOrgId: input.clerkOrgId,
    codeVerifier: input.codeVerifier,
    emulator: input.emulator,
    lightfastUserId: input.lightfastUserId,
    orgSlug: input.orgSlug,
    providerInstallationId: input.providerInstallationId,
    stateHash: hashState(state),
  };
  await redis.set(`${OAUTH_PREFIX}${attemptId}`, record, { ex: TTL_SECONDS });
  return { attemptId, state };
}

export async function consumeGitHubOAuthAttempt(input: {
  state: string;
}): Promise<GitHubBindOAuthAttemptRecord | null> {
  const envelope = decodeState(input.state);
  if (!envelope) {
    return null;
  }
  const record = await redis.getdel<GitHubBindOAuthAttemptRecord>(
    `${OAUTH_PREFIX}${envelope.attemptId}`
  );
  if (!record || record.stateHash !== hashState(input.state)) {
    return null;
  }
  return record;
}
```

- [ ] **Step 7: Run config and attempt tests**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/github-config.test.ts src/__tests__/github-bind-attempts.test.ts
pnpm --filter @api/app typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add api/app/package.json api/app/src/env.ts api/app/src/github/config.ts api/app/src/github/bind-attempts.ts api/app/src/__tests__/github-config.test.ts api/app/src/__tests__/github-bind-attempts.test.ts pnpm-lock.yaml
git commit -m "feat: add github bind attempt state"
```

---

### Task 6: Add API Setup Flow And tRPC Procedures

**Files:**
- Create: `api/app/src/github/admin-access.ts`
- Create: `api/app/src/github/setup-flow.ts`
- Create: `api/app/src/github/index.ts`
- Create: `api/app/src/router/(pending-not-allowed)/github-setup.ts`
- Modify: `api/app/src/root.ts`
- Create: `api/app/src/__tests__/github-setup-flow.test.ts`
- Create: `api/app/src/__tests__/github-setup-router.test.ts`

- [ ] **Step 1: Write setup-router tests**

Create `api/app/src/__tests__/github-setup-router.test.ts` with mocked `@vendor/upstash`, `@vendor/lib`, and `../env` following the patterns in `native-auth-router.test.ts`. The tests must assert:

```ts
expect(
  await caller.org.setup.github.start({ orgSlug: "acme" })
).toEqual({
  installationUrl:
    "https://app.lightfast.localhost/api/dev/github/install?emulator_origin=http%3A%2F%2F127.0.0.1%3A4567&installation_id=1001&provider_account_login=lightfast-emulated&state=<issued-state>",
});
```

and:

```ts
await expect(
  caller.org.setup.github.syncBindingClaim()
).resolves.toEqual({ bindingStatus: "bound" });
expect(mirrorOrgBindingMock).toHaveBeenCalledWith({
  clerkOrgId: "org_1",
  provider: "github",
  status: "bound",
});
```

- [ ] **Step 2: Write setup-flow tests**

Create `api/app/src/__tests__/github-setup-flow.test.ts` with module mocks for:

- `@db/app`
- `@repo/github-app-node`
- `@vendor/clerk/server`
- `@vendor/observability/log/next`
- `../auth/org-binding-mirror`
- `../github/bind-attempts`
- `../github/config`

Add tests for:

```ts
await expect(
  completeGitHubInstallationSetup({
    appOrigin: "https://app.lightfast.localhost",
    requestUrl:
      "https://app.lightfast.localhost/api/github/setup?installation_id=1001&state=state_install",
  })
).resolves.toEqual({
  redirectUrl: expect.stringContaining(
    "http://127.0.0.1:4567/login/oauth/authorize"
  ),
});
```

and:

```ts
await expect(
  completeGitHubOAuthVerification({
    appOrigin: "https://app.lightfast.localhost",
    requestUrl:
      "https://app.lightfast.localhost/api/github/oauth/callback?code=abc&state=state_oauth",
  })
).resolves.toEqual({
  redirectUrl:
    "https://app.lightfast.localhost/acme/tasks/bind/github/complete",
});
```

Also test missing state redirects to:

```text
https://app.lightfast.localhost/acme/tasks/bind?github_error=expired_state
```

- [ ] **Step 3: Run failing API tests**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/github-setup-router.test.ts src/__tests__/github-setup-flow.test.ts
```

Expected: FAIL because the setup flow and router do not exist.

- [ ] **Step 4: Add callback admin access helper**

Create `api/app/src/github/admin-access.ts`:

```ts
import { clerkClient } from "@vendor/clerk/server";

export async function assertUserIsOrgAdmin(input: {
  clerkOrgId: string;
  userId: string;
}): Promise<void> {
  const clerk = await clerkClient();
  const memberships = await clerk.users.getOrganizationMembershipList({
    userId: input.userId,
  });
  const membership = memberships.data.find(
    (entry) => entry.organization.id === input.clerkOrgId
  );

  if (!membership || membership.role !== "org:admin") {
    throw new Error("Only organization administrators can complete GitHub setup.");
  }
}
```

- [ ] **Step 5: Add setup-flow helpers**

Create `api/app/src/github/setup-flow.ts`:

```ts
import {
  GITHUB_OAUTH_CALLBACK_PATH,
  type GitHubBindErrorCode,
  githubInstallationMetadataSchema,
} from "@repo/github-app-contract";
import {
  GitHubAppNodeError,
  buildGitHubOAuthAuthorizeUrl,
  createGitHubPkcePair,
  exchangeGitHubOAuthCode,
  verifyGitHubEmulatorInstallation,
} from "@repo/github-app-node";
import {
  OrgSourceControlBindingConflictError,
  db,
  finalizeActiveOrgProviderBinding,
  getActiveOrgBinding,
} from "@db/app";
import { auth } from "@vendor/clerk/server";
import { log } from "@vendor/observability/log/next";
import { mirrorOrgBinding } from "../auth/org-binding-mirror";
import { assertUserIsOrgAdmin } from "./admin-access";
import {
  consumeGitHubInstallAttempt,
  consumeGitHubOAuthAttempt,
  issueGitHubOAuthAttempt,
} from "./bind-attempts";
import { getGitHubEmulatorConfig } from "./config";

export interface GitHubRedirectResult {
  redirectUrl: string;
}

function bindPageUrl(input: {
  appOrigin: string;
  code: GitHubBindErrorCode;
  orgSlug: string;
}) {
  const url = new URL(`/${input.orgSlug}/tasks/bind`, input.appOrigin);
  url.searchParams.set("github_error", input.code);
  return url.toString();
}

function completePageUrl(input: { appOrigin: string; orgSlug: string }) {
  return new URL(
    `/${input.orgSlug}/tasks/bind/github/complete`,
    input.appOrigin
  ).toString();
}

async function assertCurrentSessionCanComplete(input: {
  clerkOrgId: string;
  expectedUserId: string;
}) {
  const session = await auth({ treatPendingAsSignedOut: false });
  if (!session.userId || session.userId !== input.expectedUserId) {
    throw new Error("GitHub setup session changed.");
  }
  await assertUserIsOrgAdmin({
    clerkOrgId: input.clerkOrgId,
    userId: session.userId,
  });
}

export async function completeGitHubInstallationSetup(input: {
  appOrigin: string;
  requestUrl: string;
}): Promise<GitHubRedirectResult> {
  const requestUrl = new URL(input.requestUrl);
  const state = requestUrl.searchParams.get("state");
  const providerInstallationId = requestUrl.searchParams.get("installation_id");

  if (!(state && providerInstallationId)) {
    return {
      redirectUrl: bindPageUrl({
        appOrigin: input.appOrigin,
        code: "expired_state",
        orgSlug: "account",
      }),
    };
  }

  const attempt = await consumeGitHubInstallAttempt({ state });
  if (!attempt) {
    return {
      redirectUrl: bindPageUrl({
        appOrigin: input.appOrigin,
        code: "expired_state",
        orgSlug: "account",
      }),
    };
  }

  try {
    await assertCurrentSessionCanComplete({
      clerkOrgId: attempt.clerkOrgId,
      expectedUserId: attempt.lightfastUserId,
    });
  } catch {
    return {
      redirectUrl: bindPageUrl({
        appOrigin: input.appOrigin,
        code: "permission_required",
        orgSlug: attempt.orgSlug,
      }),
    };
  }

  const config = getGitHubEmulatorConfig({ appOrigin: input.appOrigin });
  const pkce = createGitHubPkcePair();
  const oauthAttempt = await issueGitHubOAuthAttempt({
    clerkOrgId: attempt.clerkOrgId,
    codeVerifier: pkce.codeVerifier,
    emulator: attempt.emulator,
    lightfastUserId: attempt.lightfastUserId,
    orgSlug: attempt.orgSlug,
    providerInstallationId,
  });

  return {
    redirectUrl: buildGitHubOAuthAuthorizeUrl({
      authorizationBaseUrl: `${config.installOverride.emulatorOrigin}/login/oauth/authorize`,
      clientId: config.clientId,
      codeChallenge: pkce.codeChallenge,
      redirectUri: new URL(GITHUB_OAUTH_CALLBACK_PATH, input.appOrigin).toString(),
      state: oauthAttempt.state,
    }),
  };
}

export async function completeGitHubOAuthVerification(input: {
  appOrigin: string;
  requestUrl: string;
}): Promise<GitHubRedirectResult> {
  const requestUrl = new URL(input.requestUrl);
  const denied = requestUrl.searchParams.get("error");
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");

  if (denied) {
    return {
      redirectUrl: bindPageUrl({
        appOrigin: input.appOrigin,
        code: "github_authorization_denied",
        orgSlug: "account",
      }),
    };
  }

  if (!(code && state)) {
    return {
      redirectUrl: bindPageUrl({
        appOrigin: input.appOrigin,
        code: "expired_state",
        orgSlug: "account",
      }),
    };
  }

  const attempt = await consumeGitHubOAuthAttempt({ state });
  if (!attempt) {
    return {
      redirectUrl: bindPageUrl({
        appOrigin: input.appOrigin,
        code: "expired_state",
        orgSlug: "account",
      }),
    };
  }

  try {
    await assertCurrentSessionCanComplete({
      clerkOrgId: attempt.clerkOrgId,
      expectedUserId: attempt.lightfastUserId,
    });

    const config = getGitHubEmulatorConfig({ appOrigin: input.appOrigin });
    const token = await exchangeGitHubOAuthCode({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      code,
      codeVerifier: attempt.codeVerifier,
      redirectUri: new URL(GITHUB_OAUTH_CALLBACK_PATH, input.appOrigin).toString(),
      tokenUrl: `${attempt.emulator.emulatorOrigin}/login/oauth/access_token`,
    });

    const installation = await verifyGitHubEmulatorInstallation({
      emulatorOrigin: attempt.emulator.emulatorOrigin,
      expectedInstallationId: attempt.providerInstallationId,
      expectedOrgLogin: attempt.emulator.providerAccountLogin,
      userAccessToken: token.accessToken,
    });

    const metadata = githubInstallationMetadataSchema.parse({
      events: installation.events,
      githubAppId: installation.appId,
      githubAppSlug: installation.appSlug,
      permissions: installation.permissions,
      repositorySelection: installation.repositorySelection,
      verifiedBy: "github_emulator",
    });

    await finalizeActiveOrgProviderBinding(db, {
      clerkOrgId: attempt.clerkOrgId,
      connectedByUserId: attempt.lightfastUserId,
      metadata,
      provider: "github",
      providerAccountId: installation.account.id,
      providerAccountLogin: installation.account.login,
      providerInstallationId: installation.id,
    });

    try {
      await mirrorOrgBinding({
        clerkOrgId: attempt.clerkOrgId,
        provider: "github",
        status: "bound",
      });
    } catch (error) {
      log.warn("[github-setup] Clerk mirror failed after DB bind", {
        clerkOrgId: attempt.clerkOrgId,
        error,
      });
    }

    return {
      redirectUrl: completePageUrl({
        appOrigin: input.appOrigin,
        orgSlug: attempt.orgSlug,
      }),
    };
  } catch (error) {
    if (error instanceof OrgSourceControlBindingConflictError) {
      return {
        redirectUrl: bindPageUrl({
          appOrigin: input.appOrigin,
          code:
            error.code === "ORG_ALREADY_BOUND"
              ? "org_already_bound"
              : "installation_already_bound",
          orgSlug: attempt.orgSlug,
        }),
      };
    }
    if (error instanceof GitHubAppNodeError) {
      return {
        redirectUrl: bindPageUrl({
          appOrigin: input.appOrigin,
          code:
            error.code === "PERSONAL_ACCOUNT_NOT_SUPPORTED"
              ? "personal_account_not_supported"
              : "installation_not_verified",
          orgSlug: attempt.orgSlug,
        }),
      };
    }
    log.warn("[github-setup] OAuth verification failed", { error });
    return {
      redirectUrl: bindPageUrl({
        appOrigin: input.appOrigin,
        code: "github_transient_error",
        orgSlug: attempt.orgSlug,
      }),
    };
  }
}

export async function syncGitHubBindingClaim(input: {
  clerkOrgId: string;
}): Promise<{ bindingStatus: "bound" | "unbound" }> {
  const binding = await getActiveOrgBinding(db, input.clerkOrgId);
  if (!binding) {
    return { bindingStatus: "unbound" };
  }
  await mirrorOrgBinding({
    clerkOrgId: input.clerkOrgId,
    provider: "github",
    status: "bound",
  });
  return { bindingStatus: "bound" };
}
```

- [ ] **Step 6: Add public setup router**

Create `api/app/src/router/(pending-not-allowed)/github-setup.ts`:

```ts
import { getOrgAccessBySlug } from "../../auth/organization-access";
import { getGitHubEmulatorConfig } from "../../github/config";
import { issueGitHubInstallAttempt } from "../../github/bind-attempts";
import { syncGitHubBindingClaim } from "../../github/setup-flow";
import { buildGitHubInstallationUrl } from "@repo/github-app-node";
import { clerkOrgSlugSchema } from "@repo/app-validation";
import { githubBindStartOutputSchema } from "@repo/github-app-contract";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { orgAdminProcedure, setupProcedure } from "../../trpc";

export const githubSetupRouter = {
  start: orgAdminProcedure
    .input(z.object({ orgSlug: clerkOrgSlugSchema }))
    .output(githubBindStartOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const access = await getOrgAccessBySlug({
        db: ctx.db,
        slug: input.orgSlug,
        userId: ctx.auth.identity.userId,
      });
      if (access.org.id !== ctx.auth.identity.orgId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Organization mismatch.",
        });
      }

      const appOrigin =
        ctx.headers.get("origin") ?? "https://app.lightfast.localhost";
      const config = getGitHubEmulatorConfig({ appOrigin });
      const attempt = await issueGitHubInstallAttempt({
        clerkOrgId: ctx.auth.identity.orgId,
        emulator: config.installOverride,
        lightfastUserId: ctx.auth.identity.userId,
        orgSlug: input.orgSlug,
      });

      return {
        installationUrl: buildGitHubInstallationUrl({
          appSlug: config.appSlug,
          installUrlOverride: config.installOverride.url,
          state: attempt.state,
        }),
      };
    }),

  syncBindingClaim: setupProcedure.mutation(async ({ ctx }) => {
    return await syncGitHubBindingClaim({
      clerkOrgId: ctx.auth.identity.orgId,
    });
  }),
} satisfies TRPCRouterRecord;
```

In `api/app/src/root.ts`, add:

```ts
import { githubSetupRouter } from "./router/(pending-not-allowed)/github-setup";
```

and under `org.setup`:

```ts
      github: githubSetupRouter,
```

- [ ] **Step 7: Export GitHub helpers for route handlers**

Create `api/app/src/github/index.ts`:

```ts
export {
  completeGitHubInstallationSetup,
  completeGitHubOAuthVerification,
  syncGitHubBindingClaim,
} from "./setup-flow";
export { parseGitHubInstallOverride } from "./config";
```

In `api/app/package.json`, add subpath export:

```json
"./github": {
  "types": "./src/github/index.ts",
  "default": "./src/github/index.ts"
}
```

- [ ] **Step 8: Run API tests**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/github-setup-router.test.ts src/__tests__/github-setup-flow.test.ts
pnpm --filter @api/app typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add api/app/src/github api/app/src/router/'(pending-not-allowed)'/github-setup.ts api/app/src/root.ts api/app/package.json api/app/src/__tests__/github-setup-flow.test.ts api/app/src/__tests__/github-setup-router.test.ts
git commit -m "feat: add emulator github setup flow"
```

---

### Task 7: Add App Route Handlers And Proxy Admission

**Files:**
- Modify: `apps/app/package.json`
- Create: `apps/app/src/app/(app)/(github)/api/github/setup/route.ts`
- Create: `apps/app/src/app/(app)/(github)/api/github/oauth/callback/route.ts`
- Create: `apps/app/src/app/(app)/(github)/api/dev/github/install/route.ts`
- Create: `apps/app/src/__tests__/app/api/github/github-routes.test.ts`
- Modify: `apps/app/src/proxy.ts`
- Modify: `apps/app/src/__tests__/proxy.test.ts`

- [ ] **Step 1: Write route handler tests**

In `apps/app/package.json`, add:

```json
"@repo/github-app-contract": "workspace:*",
```

under `dependencies` because the dev install shim imports public route constants.

Create `apps/app/src/__tests__/app/api/github/github-routes.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const completeSetupMock = vi.fn();
const completeOAuthMock = vi.fn();

vi.mock("@api/app/github", () => ({
  completeGitHubInstallationSetup: completeSetupMock,
  completeGitHubOAuthVerification: completeOAuthMock,
}));

describe("GitHub app route handlers", () => {
  beforeEach(() => {
    completeSetupMock.mockReset();
    completeOAuthMock.mockReset();
  });

  it("redirects setup callback to the delegated setup result", async () => {
    completeSetupMock.mockResolvedValue({
      redirectUrl: "http://127.0.0.1:4567/login/oauth/authorize?state=abc",
    });
    const { GET } = await import(
      "~/app/(app)/(github)/api/github/setup/route"
    );

    const res = await GET(
      new Request(
        "https://app.lightfast.localhost/api/github/setup?installation_id=1001&state=abc"
      )
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://127.0.0.1:4567/login/oauth/authorize?state=abc"
    );
  });

  it("redirects OAuth callback to the delegated OAuth result", async () => {
    completeOAuthMock.mockResolvedValue({
      redirectUrl:
        "https://app.lightfast.localhost/acme/tasks/bind/github/complete",
    });
    const { GET } = await import(
      "~/app/(app)/(github)/api/github/oauth/callback/route"
    );

    const res = await GET(
      new Request(
        "https://app.lightfast.localhost/api/github/oauth/callback?code=abc&state=def"
      )
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "https://app.lightfast.localhost/acme/tasks/bind/github/complete"
    );
  });
});
```

- [ ] **Step 2: Run failing route tests**

Run:

```bash
pnpm --filter @lightfast/app test -- 'src/__tests__/app/api/github/github-routes.test.ts'
```

Expected: FAIL because routes do not exist.

- [ ] **Step 3: Add thin callback route handlers**

Create `apps/app/src/app/(app)/(github)/api/github/setup/route.ts`:

```ts
import { completeGitHubInstallationSetup } from "@api/app/github";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const result = await completeGitHubInstallationSetup({
    appOrigin: new URL(req.url).origin,
    requestUrl: req.url,
  });
  return NextResponse.redirect(result.redirectUrl);
}
```

Create `apps/app/src/app/(app)/(github)/api/github/oauth/callback/route.ts`:

```ts
import { completeGitHubOAuthVerification } from "@api/app/github";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const result = await completeGitHubOAuthVerification({
    appOrigin: new URL(req.url).origin,
    requestUrl: req.url,
  });
  return NextResponse.redirect(result.redirectUrl);
}
```

- [ ] **Step 4: Add dev install shim**

Create `apps/app/src/app/(app)/(github)/api/dev/github/install/route.ts`:

```ts
import { GITHUB_SETUP_PATH } from "@repo/github-app-contract";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const state = url.searchParams.get("state");
  const installationId = url.searchParams.get("installation_id");

  if (
    process.env.VERCEL_ENV === "production" ||
    !process.env.GITHUB_INSTALL_URL_OVERRIDE
  ) {
    return Response.json({ error: "Not Found" }, { status: 404 });
  }

  if (!(state && installationId)) {
    return Response.json({ error: "Invalid GitHub install shim request" }, { status: 400 });
  }

  const redirectUrl = new URL(GITHUB_SETUP_PATH, url.origin);
  redirectUrl.searchParams.set("installation_id", installationId);
  redirectUrl.searchParams.set("setup_action", "install");
  redirectUrl.searchParams.set("state", state);
  return NextResponse.redirect(redirectUrl);
}
```

- [ ] **Step 5: Update proxy route admission**

In `apps/app/src/proxy.ts`, add to `isPublicRoute`:

```ts
  "/api/github/setup",
  "/api/github/oauth/callback",
  "/api/dev/github/install",
```

Do not add `/api/github/webhook` in this emulator-only slice.

- [ ] **Step 6: Add proxy tests**

In `apps/app/src/__tests__/proxy.test.ts`, add:

```ts
  it.each([
    "/api/github/setup",
    "/api/github/oauth/callback",
    "/api/dev/github/install",
  ])("runs Clerk middleware but does not enforce signed-in routing for %s", async (pathname) => {
    authMock.mockResolvedValue({
      orgId: null,
      orgSlug: null,
      sessionClaims: null,
      sessionStatus: "pending",
      userId: null,
    });

    const { response } = await invoke(pathname);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(authMock).not.toHaveBeenCalled();
  });
```

- [ ] **Step 7: Run app route and proxy tests**

Run:

```bash
pnpm --filter @lightfast/app test -- 'src/__tests__/app/api/github/github-routes.test.ts' 'src/__tests__/proxy.test.ts'
pnpm --filter @lightfast/app typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/app/src/app/'(app)'/'(github)' apps/app/src/proxy.ts apps/app/src/__tests__/app/api/github/github-routes.test.ts apps/app/src/__tests__/proxy.test.ts
git commit -m "feat: add github callback routes"
```

---

### Task 8: Update Bind UI And Completion Page

**Files:**
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/tasks/bind/_components/bind-github-card.tsx`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/tasks/bind/page.tsx`
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/tasks/bind/github/complete/page.tsx`
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/tasks/bind/github/complete/_components/github-bind-complete-client.tsx`
- Modify: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/tasks/bind/bind-github-card.test.tsx`
- Modify: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/tasks/bind/page.test.tsx`
- Create: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/tasks/bind/github/complete-page.test.tsx`

- [ ] **Step 1: Update bind-card tests first**

In `bind-github-card.test.tsx`, change the tRPC mock shape from `task.bind` to:

```ts
github: {
  start: {
    mutationOptions: (options: unknown) => options,
  },
},
```

Add:

```ts
const assignMock = vi.fn();
Object.defineProperty(window, "location", {
  value: { assign: assignMock },
  writable: true,
});
```

Replace the flow test with:

```ts
  it("starts the GitHub installation flow and navigates externally", async () => {
    mutateAsyncMock.mockResolvedValue({
      installationUrl:
        "https://app.lightfast.localhost/api/dev/github/install?state=abc",
    });

    render(<BindGithubCard orgSlug="acme" />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Connect GitHub organization",
      })
    );

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({ orgSlug: "acme" });
      expect(assignMock).toHaveBeenCalledWith(
        "https://app.lightfast.localhost/api/dev/github/install?state=abc"
      );
    });
    expect(reloadMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Update bind card implementation**

In `bind-github-card.tsx`:

- Remove `useSession`, `useRouter`, and `useState` imports/usages.
- Replace `trpc.org.setup.task.bind` with `trpc.org.setup.github.start`.
- In `handleConnect`, call `const result = await bindMutation.mutateAsync({ orgSlug });`.
- Replace session reload/router replace with `window.location.assign(result.installationUrl);`.

The button busy label can remain `Connecting...`.

- [ ] **Step 3: Update bind page stale-claim handling**

In `page.tsx`, if `gate.bindingStatus === "bound"`, redirect to completion page instead of workspace root:

```ts
redirect(`/${slug}/tasks/bind/github/complete` as Route);
```

This avoids a bind/root loop while the Clerk session claim is stale.

- [ ] **Step 4: Write completion page tests**

Create `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/tasks/bind/github/complete-page.test.tsx`:

```ts
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mutateAsyncMock = vi.fn();
const reloadMock = vi.fn();
const replaceMock = vi.fn();

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      setup: {
        github: {
          syncBindingClaim: {
            mutationOptions: (options: unknown) => options,
          },
        },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({
    isPending: false,
    mutateAsync: mutateAsyncMock,
  }),
}));

vi.mock("@vendor/clerk", () => ({
  useSession: () => ({ session: { reload: reloadMock } }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

const { GitHubBindCompleteClient } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/tasks/bind/github/complete/_components/github-bind-complete-client"
);

beforeEach(() => {
  mutateAsyncMock.mockReset();
  reloadMock.mockReset();
  replaceMock.mockReset();
});

describe("GitHubBindCompleteClient", () => {
  it("syncs the binding claim, reloads the Clerk session, and returns to workspace", async () => {
    mutateAsyncMock.mockResolvedValue({ bindingStatus: "bound" });
    reloadMock.mockResolvedValue(undefined);

    render(<GitHubBindCompleteClient orgSlug="acme" />);

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
      expect(reloadMock).toHaveBeenCalledTimes(1);
      expect(replaceMock).toHaveBeenCalledWith("/acme");
    });
  });

  it("shows a retry button when syncing fails", async () => {
    mutateAsyncMock.mockRejectedValueOnce(new Error("clerk failed"));

    render(<GitHubBindCompleteClient orgSlug="acme" />);

    expect(
      await screen.findByRole("button", { name: "Retry" })
    ).toBeInTheDocument();

    mutateAsyncMock.mockResolvedValueOnce({ bindingStatus: "bound" });
    reloadMock.mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/acme");
    });
  });
});
```

- [ ] **Step 5: Add completion page**

Create `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/tasks/bind/github/complete/page.tsx`:

```tsx
import { GitHubBindCompleteClient } from "./_components/github-bind-complete-client";

interface GitHubBindCompletePageProps {
  params: Promise<{ slug: string }>;
}

export default async function GitHubBindCompletePage({
  params,
}: GitHubBindCompletePageProps) {
  const { slug } = await params;
  return <GitHubBindCompleteClient orgSlug={slug} />;
}
```

Create `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/tasks/bind/github/complete/_components/github-bind-complete-client.tsx`:

```tsx
"use client";

import { Button } from "@repo/ui/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { useSession } from "@vendor/clerk";
import { Loader2 } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useTRPC } from "~/trpc/react";

interface GitHubBindCompleteClientProps {
  orgSlug: string;
}

export function GitHubBindCompleteClient({
  orgSlug,
}: GitHubBindCompleteClientProps) {
  const trpc = useTRPC();
  const router = useRouter();
  const { session } = useSession();
  const [failed, setFailed] = useState(false);

  const syncMutation = useMutation(
    trpc.org.setup.github.syncBindingClaim.mutationOptions({
      meta: { errorTitle: "Failed to finish GitHub connection" },
    })
  );

  const finish = useCallback(async () => {
    setFailed(false);
    try {
      const result = await syncMutation.mutateAsync();
      if (result.bindingStatus !== "bound") {
        setFailed(true);
        return;
      }
      await session?.reload();
      router.replace(`/${orgSlug}` as Route);
    } catch {
      setFailed(true);
    }
  }, [orgSlug, router, session, syncMutation]);

  useEffect(() => {
    void finish();
  }, [finish]);

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 pb-32">
      <div className="w-full max-w-md space-y-4">
        <h1 className="font-medium font-pp text-2xl text-foreground">
          Finishing connection...
        </h1>
        <p className="text-muted-foreground text-sm">
          Lightfast is updating your team session.
        </p>
        {failed ? (
          <Button className="w-full" onClick={() => void finish()}>
            Retry
          </Button>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Syncing GitHub binding
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run UI tests**

Run:

```bash
pnpm --filter @lightfast/app test -- 'src/__tests__/app/(app)/(pending-not-allowed)/[slug]/tasks/bind/bind-github-card.test.tsx' 'src/__tests__/app/(app)/(pending-not-allowed)/[slug]/tasks/bind/page.test.tsx' 'src/__tests__/app/(app)/(pending-not-allowed)/[slug]/tasks/bind/github/complete-page.test.tsx'
pnpm --filter @lightfast/app typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/app/src/app/'(app)'/'(pending-not-allowed)'/'[slug]'/tasks/bind apps/app/src/__tests__/app/'(app)'/'(pending-not-allowed)'/'[slug]'/tasks/bind
git commit -m "feat: start github binding from setup UI"
```

---

### Task 9: Run Local Emulator Smoke Test

**Files:**
- No source edits unless the smoke test exposes a defect in earlier tasks.

- [ ] **Step 1: Start the GitHub emulator**

Run:

```bash
pnpm --filter @repo/github-emulator dev
```

Expected output starts with:

```text
[github-emulator] listening on http://127.0.0.1:4567
```

Keep this process running.

- [ ] **Step 2: Add emulator env values**

Copy the printed values into `apps/app/.vercel/.env.development.local`. Ensure the override value is:

```text
GITHUB_INSTALL_URL_OVERRIDE="https://app.lightfast.localhost/api/dev/github/install?emulator_origin=http%3A%2F%2F127.0.0.1%3A4567&installation_id=1001&provider_account_login=lightfast-emulated"
```

- [ ] **Step 3: Start Lightfast dev**

Run from the repo root:

```bash
pnpm dev
```

Expected: app, www, platform, Inngest, QStash, Portless, and MFE aggregate start. Use `https://app.lightfast.localhost` for direct app testing.

- [ ] **Step 4: Exercise the local flow manually**

In a signed-in local org admin session:

1. Visit `https://app.lightfast.localhost/<slug>/tasks/bind`.
2. Click `Connect GitHub organization`.
3. Choose `lightfast-dev` in the emulator OAuth user picker.
4. Confirm the browser returns to `/<slug>/tasks/bind/github/complete`.
5. Confirm the completion page redirects to `/<slug>`.

Expected:

- The DB row in `lightfast_org_source_control_bindings` has `provider = "github"`, `provider_installation_id = "1001"`, `provider_account_login = "lightfast-emulated"`, and `status = "active"`.
- Clerk session reload mints `lf_binding_status: "bound"`.
- Product route no longer redirects to `/tasks/bind`.

- [ ] **Step 5: Run full focused checks**

Stop dev servers, then run:

```bash
pnpm --filter @repo/github-emulator test
pnpm --filter @repo/github-app-contract test
pnpm --filter @repo/github-app-node test
pnpm --filter @api/app test -- src/__tests__/github-bind-attempts.test.ts src/__tests__/github-config.test.ts src/__tests__/github-setup-flow.test.ts src/__tests__/github-setup-router.test.ts src/__tests__/org-binding-helpers.test.ts
pnpm --filter @lightfast/app test -- 'src/__tests__/app/api/github/github-routes.test.ts' 'src/__tests__/proxy.test.ts' 'src/__tests__/app/(app)/(pending-not-allowed)/[slug]/tasks/bind/bind-github-card.test.tsx' 'src/__tests__/app/(app)/(pending-not-allowed)/[slug]/tasks/bind/page.test.tsx' 'src/__tests__/app/(app)/(pending-not-allowed)/[slug]/tasks/bind/github/complete-page.test.tsx'
pnpm --filter @repo/github-emulator typecheck
pnpm --filter @repo/github-app-contract typecheck
pnpm --filter @repo/github-app-node typecheck
pnpm --filter @api/app typecheck
pnpm --filter @lightfast/app typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git status --short
git add docs/superpowers/plans/2026-05-28-github-org-binding-emulator.md
git commit -m "docs: plan github binding emulator slice"
```

---

## Self-Review

Spec coverage:

- Covers the local emulator harness, deterministic seed, fixed emulator origin, dev install shim, `GITHUB_INSTALL_URL_OVERRIDE`, setup/OAuth callbacks, Redis attempts, DB binding finalization, Clerk claim sync, and completion UI.
- Explicitly leaves real GitHub install verification, `/user/installations`, webhooks, and production enablement out of this emulator-first slice.
- Keeps `apps/app` route handlers thin and keeps GitHub API mechanics in `@repo/github-app-node`.
- Keeps `emulators/github` dev-only and not imported by production packages.

Placeholder scan:

- No placeholder or fill-in implementation steps remain.
- Patch commit commands intentionally refer to the path printed by `pnpm patch`, which is only known while executing the plan.

Type consistency:

- Route constants come from `@repo/github-app-contract`.
- Node helpers return `GitHubNormalizedInstallation`.
- API setup maps normalized installation data into `finalizeActiveOrgProviderBinding`.
- UI consumes only `org.setup.github.start` and `org.setup.github.syncBindingClaim`.

Residual risk:

- The setup-flow code in this plan is intentionally emulator-first and rejects production. Real GitHub support must be a follow-up plan.
- The emulator package mutates `@emulators/github` store internals to create org membership because `GitHubSeedConfig` does not expose membership seed data in `0.6.0`.
- The `emulate` patch is narrow but touches bundled files; remove it after upstream accepts the public-key verification fix.
