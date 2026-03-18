# Type Cast Elimination — BoundAuth + ProviderHandle Architecture

## Overview

Eliminate every `as` type cast from the provider–gateway boundary by introducing a **BoundAuth discriminated union** and **ProviderHandle** pattern. The gateway never touches `TConfig` or raw `ProviderDefinition` again — it works exclusively through pre-bound handles where config is captured in closures at startup. This achieves zero-cast type safety at every call site while preserving the discriminated-union narrowing that makes auth kind switches exhaustive.

## Current State Analysis

The provider system has **22 type casts** spread across 4 files. The dominant root cause (13 casts) is the **config–provider pairing problem**: the gateway stores provider configs as `Record<string, unknown>` but needs to call type-safe auth methods requiring concrete `TConfig`. String-based lookup at runtime erases the type association.

### Key Discoveries:
- `connections.ts:49` — `providerConfigs: Record<string, unknown>` is the root of 13 casts
- `connections.ts:129,131` — double cast pattern: `(auth as OAuthDef<never>).buildAuthUrl(config as never, state)`
- `connections.ts:706,878,949` — `providerDef as ProviderDefinition` because helpers take base type
- `define.ts:387` — `typedEntityHandler` uses `return handler as BackfillEntityHandler` (contravariant cursor)
- `define.ts:638` — `envSchema as Record<string, z.ZodType<string>>` because base type is too wide
- `define.ts:700,756` — factory functions cast `Object.freeze(result)` because spread inference fails
- `registry.ts:98,120,130` — three casts in event registry build and `getProvider` overload
- `github/index.test.ts:27` — `github.auth as unknown as AppTokenDef<GitHubConfig>` double cast

### Cast Inventory (22 total):

| File | Count | Root Cause |
|------|-------|-----------|
| `connections.ts` | 13 | `providerConfigs: Record<string, unknown>` erases TConfig |
| `define.ts` | 5 | Factory returns, envSchema width, typedEntityHandler variance |
| `registry.ts` | 3 | `Object.entries` inference, runtime-built registry, string overload |
| `github/index.test.ts` | 1 | Auth union not narrowed |

## Desired End State

After all phases:

- **Zero casts** at any gateway call site — the handle API is fully type-safe
- **BoundAuth** is a 3-member discriminated union (`BoundOAuth | BoundAppToken | BoundApiKey`) — the gateway narrows with `switch (auth.kind)` and TypeScript guarantees exhaustive handling
- **ProviderHandle** is the gateway's exclusive API surface — `TConfig` is never visible
- **`createProviderHandles()`** is the single initialization point — generic inference captures type associations at the moment they're still known, then erases
- **Factory functions** use type annotations instead of return casts
- **`typedEntityHandler`** uses an adapter wrapper with internal casts (2, unavoidable due to contravariant cursor)
- **Registry** uses `isProviderName` type guard and widening cast on `Object.entries`
- **Tests** use `isAppTokenAuth` type guard instead of double cast

### Verification:
```bash
pnpm typecheck                                    # zero errors
pnpm check                                        # zero lint errors
pnpm --filter @repo/console-providers test         # all tests pass
pnpm --filter gateway build                        # gateway builds clean
```

## What We're NOT Doing

- **Changing the relay** — the relay has its own `webhookSecretEnvKey` map; that's a separate refactor
- **Adding `BoundWebhook`** — only `extractSecret` takes TConfig on WebhookDef; relay owns signature verification, not gateway
- **Changing `BackfillDef`, `ResourcePickerDef`, or `ProviderApi`** — these don't take TConfig at their call sites
- **Database schema changes** — purely a TypeScript type-level refactor
- **Modifying provider implementations** (github, linear, sentry, vercel, apollo) — providers are unchanged; only the consumer (gateway) and the binding layer change
- **Changing the `ProviderDefinition` type hierarchy** — WebhookProvider and ApiProvider interfaces stay as-is

## Implementation Approach

The architecture introduces three concepts:

1. **BoundAuth** — A discriminated union where each variant pre-binds TConfig. Methods that previously took `(config: TConfig, ...)` become `(...)`. The union preserves `kind` for narrowing.

2. **ProviderHandle** — A type-erased facade combining `BoundAuth` + the base `ProviderDefinition` (for config-independent access to `api`, `events`, etc.). The gateway works exclusively through handles.

3. **`createProviderHandles()`** — A factory called once at startup. Inside, TypeScript knows `typeof PROVIDERS[K]` and `TConfig` simultaneously. The factory creates bound closures and returns `Record<string, ProviderHandle>` — TConfig is captured and erased.

Phases are ordered by dependency. Phase 1 creates the types. Phase 2 migrates the gateway. Phase 3 fixes define.ts internals. Phase 4 fixes registry. Phase 5 fixes tests.

---

## Phase 1: BoundAuth Discriminated Union + ProviderHandle

### Overview
Create the binding layer: `BoundAuth` (discriminated union), `ProviderHandle`, `bindAuth()`, and `createProviderHandles()`. This is pure additive — no existing code changes.

### Changes Required:

#### 1. New file: `packages/console-providers/src/bound.ts`
**File**: `packages/console-providers/src/bound.ts` (new)
**Changes**: Define BoundAuth variants, ProviderHandle, and binding factories.

```typescript
import type {
  ApiKeyDef,
  AppTokenDef,
  AuthDef,
  OAuthDef,
  ProviderDefinition,
  RuntimeConfig,
} from "./define";
import type {
  BaseProviderAccountInfo,
  CallbackResult,
  OAuthTokens,
} from "./types";

// ── BoundAuth Discriminated Union ────────────────────────────────────────────
// Each variant closes over TConfig. The gateway narrows on `kind` and gets
// exhaustive method access — no optional chaining, no runtime undefined checks.

export interface BoundOAuth {
  readonly kind: "oauth";
  readonly usesStoredToken: true;
  readonly buildAuthUrl: (
    state: string,
    options?: Record<string, unknown>
  ) => string;
  readonly processCallback: (
    query: Record<string, string>
  ) => Promise<CallbackResult>;
  readonly getActiveToken: (
    storedExternalId: string,
    storedAccessToken: string | null
  ) => Promise<string>;
  readonly refreshToken: (refreshToken: string) => Promise<OAuthTokens>;
  readonly revokeToken: (accessToken: string) => Promise<void>;
}

export interface BoundAppToken {
  readonly kind: "app-token";
  readonly usesStoredToken: false;
  readonly buildInstallUrl: (
    state: string,
    options?: Record<string, unknown>
  ) => string;
  readonly processCallback: (
    query: Record<string, string>
  ) => Promise<CallbackResult>;
  readonly getActiveToken: (
    storedExternalId: string,
    storedAccessToken: string | null
  ) => Promise<string>;
  readonly getAppToken?: () => Promise<string>;
  readonly revokeAccess?: (externalId: string) => Promise<void>;
}

export interface BoundApiKey {
  readonly kind: "api-key";
  readonly usesStoredToken: true;
  readonly buildAuthHeader: (apiKey: string) => string;
  readonly processSetup: (params: {
    apiKey: string;
  }) => Promise<CallbackResult>;
  readonly getActiveToken: (
    storedExternalId: string,
    storedAccessToken: string | null
  ) => Promise<string>;
  readonly revokeToken?: (apiKey: string) => Promise<void>;
}

/** Discriminated union — exhaustive narrowing on `kind` */
export type BoundAuth = BoundOAuth | BoundAppToken | BoundApiKey;

// ── Binding Factories ────────────────────────────────────────────────────────

/** Bind an OAuthDef — closes over TConfig in every method */
function bindOAuth<TConfig, TAccountInfo extends BaseProviderAccountInfo>(
  auth: OAuthDef<TConfig, TAccountInfo>,
  config: TConfig
): BoundOAuth {
  return {
    kind: "oauth",
    usesStoredToken: true,
    buildAuthUrl: (state, options) => auth.buildAuthUrl(config, state, options),
    processCallback: (query) => auth.processCallback(config, query),
    getActiveToken: (externalId, accessToken) =>
      auth.getActiveToken(config, externalId, accessToken),
    refreshToken: (refreshToken) => auth.refreshToken(config, refreshToken),
    revokeToken: (accessToken) => auth.revokeToken(config, accessToken),
  };
}

/** Bind an AppTokenDef — closes over TConfig in every method */
function bindAppToken<
  TConfig,
  TAccountInfo extends BaseProviderAccountInfo,
>(
  auth: AppTokenDef<TConfig, TAccountInfo>,
  config: TConfig
): BoundAppToken {
  return {
    kind: "app-token",
    usesStoredToken: false,
    buildInstallUrl: (state, options) =>
      auth.buildInstallUrl(config, state, options),
    processCallback: (query) => auth.processCallback(config, query),
    getActiveToken: (externalId, accessToken) =>
      auth.getActiveToken(config, externalId, accessToken),
    ...(auth.getAppToken
      ? { getAppToken: () => auth.getAppToken!(config) }
      : {}),
    ...(auth.revokeAccess
      ? { revokeAccess: (externalId: string) => auth.revokeAccess!(config, externalId) }
      : {}),
  };
}

/** Bind an ApiKeyDef — closes over TConfig in every method */
function bindApiKey<TConfig, TAccountInfo extends BaseProviderAccountInfo>(
  auth: ApiKeyDef<TConfig, TAccountInfo>,
  config: TConfig
): BoundApiKey {
  return {
    kind: "api-key",
    usesStoredToken: true,
    buildAuthHeader: auth.buildAuthHeader,
    processSetup: (params) => auth.processSetup(config, params),
    getActiveToken: (externalId, accessToken) =>
      auth.getActiveToken(config, externalId, accessToken),
    ...(auth.revokeToken
      ? { revokeToken: (apiKey: string) => auth.revokeToken!(config, apiKey) }
      : {}),
  };
}

/** Bind any AuthDef to its BoundAuth variant — dispatches on `kind` */
export function bindAuth<
  TConfig,
  TAccountInfo extends BaseProviderAccountInfo,
>(
  auth: AuthDef<TConfig, TAccountInfo>,
  config: TConfig
): BoundAuth {
  switch (auth.kind) {
    case "oauth":
      return bindOAuth(auth, config);
    case "app-token":
      return bindAppToken(auth, config);
    case "api-key":
      return bindApiKey(auth, config);
  }
}

// ── ProviderHandle ───────────────────────────────────────────────────────────

/**
 * Type-erased facade for gateway consumption.
 * TConfig is captured in BoundAuth closures — never exposed.
 * The `def` field provides config-independent access (api, events, etc.).
 */
export interface ProviderHandle {
  readonly name: string;
  readonly kind: "webhook" | "api";
  readonly auth: BoundAuth;
  readonly def: ProviderDefinition;
}

/**
 * Build ProviderHandles from the PROVIDERS registry.
 * Called once at startup while TypeScript still knows concrete types.
 * Returns only providers whose createConfig() succeeds (non-null).
 */
export function createProviderHandles(
  providers: Record<string, ProviderDefinition>,
  env: Readonly<Record<string, string | undefined>>,
  runtime: RuntimeConfig
): Record<string, ProviderHandle> {
  return Object.fromEntries(
    Object.entries(providers).flatMap(([name, provider]) => {
      // createConfig validates env vars and returns null for absent optional providers
      const config = provider.createConfig(
        env as Record<string, string>,
        runtime
      );
      if (config == null) return [];
      return [
        [
          name,
          {
            name,
            kind: provider.kind,
            auth: bindAuth(provider.auth, config),
            def: provider,
          } satisfies ProviderHandle,
        ],
      ];
    })
  );
}
```

**Design decision — BoundAuth as discriminated union (not flat optional interface)**:

The research document proposed a flat `BoundAuth` with optional fields (`buildStartUrl?: ...`, `processCallback?: ...`, `refreshToken?: ...`). This plan uses a **discriminated union** instead because:

1. **Exhaustive narrowing**: `switch (handle.auth.kind)` forces the gateway to handle every auth variant. Adding a new auth kind (e.g., `"service-account"`) causes compile errors at every switch — impossible to miss.
2. **No optional chaining**: `BoundOAuth.refreshToken` is guaranteed present — no `?.` or `!` needed. `BoundAppToken.revokeAccess` is genuinely optional (only GitHub has it).
3. **Method signatures match the kind**: `BoundOAuth.buildAuthUrl` vs `BoundAppToken.buildInstallUrl` — the gateway can't accidentally call the wrong method.
4. **Mirrors the source**: `AuthDef` is already a discriminated union (`OAuthDef | ApiKeyDef | AppTokenDef`). `BoundAuth` preserves this structure through the binding.

#### 2. Export from barrel
**File**: `packages/console-providers/src/index.ts`
**Changes**: Add exports for the new types and factory.

```typescript
// ── Bound Auth (type-erased gateway facade) ──────────────────────────────────
export type {
  BoundApiKey,
  BoundAppToken,
  BoundAuth,
  BoundOAuth,
  ProviderHandle,
} from "./bound";
export { bindAuth, createProviderHandles } from "./bound";
```

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Lint passes: `pnpm check`
- [ ] All tests pass: `pnpm --filter @repo/console-providers test`
- [ ] New file `bound.ts` exists with BoundOAuth, BoundAppToken, BoundApiKey, BoundAuth, ProviderHandle, bindAuth, createProviderHandles

#### Manual Verification:
- [ ] Code review confirms BoundAuth preserves discriminated union semantics (narrowing on `kind`)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 2: Gateway Migration — Replace providerConfigs with ProviderHandles

### Overview
Rewrite `connections.ts` to use `ProviderHandle` exclusively. This eliminates **13 `config as never` casts** and **3 `providerDef as ProviderDefinition` casts** — 16 of 22 total casts.

### Changes Required:

#### 1. Replace module-level initialization
**File**: `apps/gateway/src/routes/connections.ts`
**Changes**: Replace `providerConfigs: Record<string, unknown>` with `providerHandles: Record<string, ProviderHandle>`.

```typescript
// Before (lines 43-59):
const providerConfigs: Record<string, unknown> = Object.fromEntries(
  Object.entries(PROVIDERS)
    .map(([name, p]) => [name, p.createConfig(env as unknown as Record<string, string>, runtime)] as const)
    .filter(([, config]) => config !== null)
);

// After:
import { createProviderHandles, type ProviderHandle } from "@repo/console-providers";

const providerHandles = createProviderHandles(PROVIDERS, env, runtime);
```

This also eliminates the `env as unknown as Record<string, string>` cast (line 55) — it moves inside `createProviderHandles` where it's handled once.

#### 2. Helper to get handle
**File**: `apps/gateway/src/routes/connections.ts`
**Changes**: Add a helper function that replaces the `getProvider` + `providerConfigs[name]` lookup pattern.

```typescript
function getHandle(providerName: string): ProviderHandle | undefined {
  return providerHandles[providerName];
}
```

#### 3. Rewrite authorize handler
**File**: `apps/gateway/src/routes/connections.ts`
**Changes**: Replace the double-cast `(auth as OAuthDef<never>).buildAuthUrl(config as never, state)` pattern.

```typescript
// Before (lines 122-134):
const auth = providerDef.auth;
if (auth.kind === "oauth") {
  url = (auth as OAuthDef<never>).buildAuthUrl(config as never, state);
} else if (auth.kind === "app-token") {
  url = (auth as AppTokenDef<never>).buildInstallUrl(config as never, state);
}

// After:
const handle = getHandle(providerName);
if (!handle) return c.json({ error: "unknown_provider", provider: providerName }, 400);

const { auth } = handle;
if (auth.kind === "oauth") {
  url = auth.buildAuthUrl(state);           // TS narrows to BoundOAuth
} else if (auth.kind === "app-token") {
  url = auth.buildInstallUrl(state);        // TS narrows to BoundAppToken
} else {
  return c.json({ error: "provider_does_not_support_oauth" }, 400);
}
```

Zero casts. TypeScript narrows `auth` through the discriminated union.

#### 4. Rewrite callback handler
**File**: `apps/gateway/src/routes/connections.ts`
**Changes**: Replace `auth.processCallback(config as never, query)`.

```typescript
// Before (line 276):
const result = await auth.processCallback(config as never, query);

// After:
const result = await handle.auth.processCallback(query);
```

Both `BoundOAuth` and `BoundAppToken` have `processCallback` — the union type resolves it. The guard `auth.kind !== "oauth" && auth.kind !== "app-token"` narrows correctly.

#### 5. Rewrite `getActiveTokenForInstallation`
**File**: `apps/gateway/src/routes/connections.ts`
**Changes**: Change signature from `(installation, config, providerDef)` to `(installation, auth: BoundAuth)`. Eliminate 3 casts.

```typescript
// Before (lines 550-606):
async function getActiveTokenForInstallation(
  installation: { id: string; externalId: string; provider: string },
  config: unknown,
  providerDef: ProviderDefinition
): Promise<{ token: string; expiresAt: string | null }> {
  // ...
  const refreshed = await auth.refreshToken(config as never, decryptedRefresh);
  // ...
  const token = await providerDef.auth.getActiveToken(config as never, ...);
}

// After:
async function getActiveTokenForInstallation(
  installation: { id: string; externalId: string },
  auth: BoundAuth
): Promise<{ token: string; expiresAt: string | null }> {
  const tokenRows = await db
    .select()
    .from(gatewayTokens)
    .where(eq(gatewayTokens.installationId, installation.id))
    .limit(1);

  const tokenRow = tokenRows[0];

  // Handle refresh if expired
  if (tokenRow?.expiresAt && new Date(tokenRow.expiresAt) < new Date()) {
    if (!tokenRow.refreshToken) {
      throw new Error("token_expired:no_refresh_token");
    }
    const decryptedRefresh = await decrypt(
      tokenRow.refreshToken,
      getEncryptionKey()
    );
    // Only OAuth providers support token refresh — narrowing is exhaustive
    if (auth.kind !== "oauth") {
      throw new Error("token_expired:provider_does_not_support_token_refresh");
    }
    const refreshed = await auth.refreshToken(decryptedRefresh);
    await updateTokenRecord(
      tokenRow.id,
      refreshed,
      tokenRow.refreshToken,
      tokenRow.expiresAt
    );
    return { token: refreshed.accessToken, expiresAt: tokenRow.expiresAt };
  }

  const decryptedAccessToken = tokenRow
    ? await decrypt(tokenRow.accessToken, getEncryptionKey())
    : null;

  // All auth kinds have getActiveToken — no narrowing needed
  const token = await auth.getActiveToken(
    installation.externalId,
    decryptedAccessToken
  );

  return { token, expiresAt: tokenRow?.expiresAt ?? null };
}
```

Zero casts. `auth.refreshToken` is only available when narrowed to `BoundOAuth`. `auth.getActiveToken` is on all three variants.

#### 6. Rewrite `forceRefreshToken`
**File**: `apps/gateway/src/routes/connections.ts`
**Changes**: Same signature change — takes `BoundAuth` instead of `(config, providerDef)`.

```typescript
// Before (lines 612-665):
async function forceRefreshToken(
  installation: { id: string; externalId: string; provider: string },
  config: unknown,
  providerDef: ProviderDefinition
): Promise<string | null> {
  // ... auth.refreshToken(config as never, ...)
  // ... providerDef.auth.getActiveToken(config as never, ...)
}

// After:
async function forceRefreshToken(
  installation: { id: string; externalId: string },
  auth: BoundAuth
): Promise<string | null> {
  const tokenRows = await db
    .select()
    .from(gatewayTokens)
    .where(eq(gatewayTokens.installationId, installation.id))
    .limit(1);
  const row = tokenRows[0];

  if (row?.refreshToken) {
    try {
      const decryptedRefresh = await decrypt(
        row.refreshToken,
        getEncryptionKey()
      );
      if (auth.kind !== "oauth") {
        return null; // Only OAuth providers support token refresh
      }
      const refreshed = await auth.refreshToken(decryptedRefresh);
      await updateTokenRecord(
        row.id,
        refreshed,
        row.refreshToken,
        row.expiresAt
      );
      return refreshed.accessToken;
    } catch {
      // Refresh failed — fall through to getActiveToken
    }
  }

  try {
    return await auth.getActiveToken(installation.externalId, null);
  } catch {
    return null;
  }
}
```

Zero casts.

#### 7. Update all call sites
**File**: `apps/gateway/src/routes/connections.ts`
**Changes**: Every place that called `getActiveTokenForInstallation(installation, config, providerDef as ProviderDefinition)` now calls `getActiveTokenForInstallation(installation, handle.auth)`.

```typescript
// GET /:id/token (line 705-708):
// Before: getActiveTokenForInstallation(installation, config, providerDef as ProviderDefinition)
// After:
const handle = getHandle(providerName);
const { token, expiresAt } = await getActiveTokenForInstallation(installation, handle.auth);

// POST /:id/proxy/execute (line 874-878):
// Before: getActiveTokenForInstallation(installation, config, providerDef as ProviderDefinition)
// After:
const handle = getHandle(providerName);
({ token } = await getActiveTokenForInstallation(installation, handle.auth));

// 401 retry (line 946-950):
// Before: forceRefreshToken(installation, config, providerDef as ProviderDefinition)
// After:
freshToken = await forceRefreshToken(installation, handle.auth);
```

All 3 `providerDef as ProviderDefinition` casts eliminated.

#### 8. Remove unused imports
**File**: `apps/gateway/src/routes/connections.ts`
**Changes**: Remove `OAuthDef`, `AppTokenDef`, and `ProviderDefinition` type imports — no longer needed.

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Lint passes: `pnpm check`
- [ ] Gateway builds: `pnpm --filter gateway build`
- [ ] `connections.ts` contains zero `as never` casts
- [ ] `connections.ts` contains zero `as ProviderDefinition` casts
- [ ] `connections.ts` contains zero `as OAuthDef` or `as AppTokenDef` casts
- [ ] Grep confirms: `grep -c 'as never\|as ProviderDefinition\|as OAuthDef\|as AppTokenDef' apps/gateway/src/routes/connections.ts` returns 0

#### Manual Verification:
- [ ] GitHub App installation flow works end-to-end (install → callback → token generation)
- [ ] OAuth provider flow works (Linear or Vercel: authorize → callback → token storage)
- [ ] API proxy endpoint returns data correctly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 3: define.ts — Factory Returns, envSchema, typedEntityHandler

### Overview
Eliminate the remaining 5 casts in `define.ts`: factory return casts (2), envSchema cast (1), createConfig env param cast (1, moved to createProviderHandles), and typedEntityHandler (1).

### Changes Required:

#### 1. Constrain `envSchema` to `ZodType<string>`
**File**: `packages/console-providers/src/define.ts`
**Changes**: Change line 496 from `Record<string, z.ZodType>` to `Record<string, z.ZodType<string>>`.

```typescript
// Before (line 496):
readonly envSchema: Record<string, z.ZodType>;

// After:
readonly envSchema: Record<string, z.ZodType<string>>;
```

Then remove the cast in `buildEnvGetter` (line 638):

```typescript
// Before (line 638):
server: envSchema as Record<string, z.ZodType<string>>,

// After:
server: envSchema,
```

And update `buildEnvGetter` parameter type to match:

```typescript
// Before (line 631-632):
function buildEnvGetter(
  envSchema: Record<string, z.ZodType>

// After:
function buildEnvGetter(
  envSchema: Record<string, z.ZodType<string>>
```

All existing providers use `z.string()`, `z.string().min(1)`, or `z.string().default("")` — all output `string`. No provider changes needed.

#### 2. Widen `createConfig` env parameter
**File**: `packages/console-providers/src/define.ts`
**Changes**: Change `createConfig`'s `env` parameter (line 481) to accept the wider type.

```typescript
// Before (line 480-483):
readonly createConfig: (
  env: Record<string, string>,
  runtime: RuntimeConfig
) => TConfig | null;

// After:
readonly createConfig: (
  env: Readonly<Record<string, string | undefined>>,
  runtime: RuntimeConfig
) => TConfig | null;
```

This eliminates the `env as unknown as Record<string, string>` cast in `connections.ts:55` (which moved to `createProviderHandles` in Phase 2, and with this change needs no cast at all).

Update `createProviderHandles` in `bound.ts` to remove the cast:

```typescript
// Before (in createProviderHandles):
const config = provider.createConfig(
  env as Record<string, string>,
  runtime
);

// After:
const config = provider.createConfig(env, runtime);
```

#### 3. Type-annotate factory results (eliminate return casts)
**File**: `packages/console-providers/src/define.ts`
**Changes**: Replace `Object.freeze(result) as WebhookProvider<...>` with a type-annotated variable.

For `defineWebhookProvider` (lines 691-708):
```typescript
// Before:
const result = {
  ...def,
  kind: "webhook" as const,
  get env(): Record<string, string> {
    _env ??= buildEnvGetter(def.envSchema);
    return _env;
  },
};
return Object.freeze(result) as WebhookProvider<...>;

// After:
const result: WebhookProvider<
  TConfig,
  TAccountInfo,
  TCategories,
  TEvents,
  TAccountInfoSchema,
  TProviderConfigSchema
> = {
  ...def,
  kind: "webhook" as const,
  get env(): Record<string, string> {
    _env ??= buildEnvGetter(def.envSchema);
    return _env;
  },
};
return Object.freeze(result);
```

`Object.freeze` returns `Readonly<T>`. Since all `WebhookProvider` fields are `readonly`, `Readonly<WebhookProvider<...>>` is structurally identical — no cast needed on the return.

Same pattern for `defineApiProvider` (lines 746-763).

**Note**: If TypeScript can't verify the spread satisfies the full interface (due to `env` getter on an intersection), fall back to using `satisfies` instead of annotation:

```typescript
const result = {
  ...def,
  kind: "webhook" as const,
  get env(): Record<string, string> { ... },
} satisfies WebhookProvider<...>;
return Object.freeze(result);
```

If neither works without error, this specific cast is acceptable as a known TypeScript limitation with spread + getter inference. Document it with a `// CAST: Object.freeze + getter spread` comment.

#### 4. Rewrite `typedEntityHandler` with adapter wrapper
**File**: `packages/console-providers/src/define.ts`
**Changes**: Replace `return handler as BackfillEntityHandler` with an adapter that wraps the typed methods.

```typescript
// Before (lines 366-388):
export function typedEntityHandler<TCursor>(handler: {
  endpointId: string;
  buildRequest(ctx: BackfillContext, cursor: TCursor | null): { ... };
  processResponse(data: unknown, ctx: BackfillContext, cursor: TCursor | null, responseHeaders?: Record<string, string>): { ... };
}): BackfillEntityHandler {
  return handler as BackfillEntityHandler;
}

// After:
export function typedEntityHandler<TCursor>(handler: {
  endpointId: string;
  buildRequest(ctx: BackfillContext, cursor: TCursor | null): {
    pathParams?: Record<string, string>;
    queryParams?: Record<string, string>;
    body?: unknown;
  };
  processResponse(
    data: unknown,
    ctx: BackfillContext,
    cursor: TCursor | null,
    responseHeaders?: Record<string, string>
  ): {
    events: BackfillWebhookEvent[];
    nextCursor: TCursor | null;
    rawCount: number;
  };
}): BackfillEntityHandler {
  // Adapter bridges the typed handler to the erased BackfillEntityHandler contract.
  // The platform guarantees that nextCursor from processResponse is always passed
  // back to buildRequest for the same handler — the runtime type is always correct.
  return {
    endpointId: handler.endpointId,
    buildRequest(ctx: BackfillContext, cursor: unknown) {
      return handler.buildRequest(ctx, cursor as TCursor | null);
    },
    processResponse(data, ctx, cursor, responseHeaders) {
      return handler.processResponse(
        data,
        ctx,
        cursor as TCursor | null,
        responseHeaders
      );
    },
  };
}
```

This moves from 1 unsafe cast (`handler as BackfillEntityHandler` — casts the entire object) to 2 internal casts (`cursor as TCursor | null` — casts only the cursor parameter, at the boundary where the invariant holds). The adapter is structurally correct at its external boundary.

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Lint passes: `pnpm check`
- [ ] All tests pass: `pnpm --filter @repo/console-providers test`
- [ ] `define.ts` contains zero `as Record<string, z.ZodType<string>>` casts
- [ ] `define.ts` factory functions contain no return casts (or documented exception)
- [ ] `typedEntityHandler` uses adapter pattern, not `handler as BackfillEntityHandler`

#### Manual Verification:
- [ ] Review confirms no provider implementation changes needed (all envSchema values already return `string`)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 4: Registry — Type Guards and Widening Casts

### Overview
Eliminate 2 of 3 casts in `registry.ts`. The `EVENT_REGISTRY` return cast (1) is unavoidable — document it.

### Changes Required:

#### 1. `isProviderName` type guard
**File**: `packages/console-providers/src/registry.ts`
**Changes**: Add type guard, rewrite `getProvider` string overload.

```typescript
// Add before getProvider:
function isProviderName(name: string): name is ProviderName {
  return Object.prototype.hasOwnProperty.call(PROVIDERS, name);
}

// Rewrite getProvider (lines 125-131):
export function getProvider<N extends ProviderName>(
  name: N
): (typeof PROVIDERS)[N];
export function getProvider(name: string): ProviderDefinition | undefined;
export function getProvider(name: string): ProviderDefinition | undefined {
  if (!isProviderName(name)) return undefined;
  return PROVIDERS[name]; // no cast — TS narrows name to ProviderName
}
```

Eliminates: `(PROVIDERS as Record<string, ProviderDefinition>)[name]`

#### 2. Widen `Object.entries` cast at iteration level
**File**: `packages/console-providers/src/registry.ts`
**Changes**: Cast the iterable, not the individual value.

```typescript
// Before (lines 97-98):
for (const [eventKey, eventDef] of Object.entries(provider.events)) {
  const def = eventDef as EventDefinition;

// After:
for (const [eventKey, def] of Object.entries(provider.events) as [string, EventDefinition][]) {
```

This moves the cast from the value level (unsafe — arbitrary narrowing) to the iteration level (safe — widening from specific union to base type).

#### 3. Document the unavoidable EVENT_REGISTRY return cast
**File**: `packages/console-providers/src/registry.ts`
**Changes**: Add explanatory comment to the remaining cast.

```typescript
// Line 120 — unavoidable: runtime-built object cannot be statically verified
// to have exactly the keys described by the EventKey type union
return registry as Record<EventKey, EventRegistryEntry>;
```

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Lint passes: `pnpm check`
- [ ] All tests pass: `pnpm --filter @repo/console-providers test`
- [ ] `getProvider` implementation contains no `as` cast

#### Manual Verification:
- [ ] Review confirms EVENT_REGISTRY return cast is documented as unavoidable

---

## Phase 5: Test — Replace Auth Double Cast with Type Guard

### Overview
Replace the `github.auth as unknown as AppTokenDef<GitHubConfig>` double cast with the `isAppTokenAuth` type guard.

### Changes Required:

#### 1. GitHub test
**File**: `packages/console-providers/src/providers/github/index.test.ts`
**Changes**: Replace line 27.

```typescript
// Before (line 27):
const githubAppToken = github.auth as unknown as AppTokenDef<GitHubConfig>;

// After:
import { isAppTokenAuth } from "../../define";

if (!isAppTokenAuth(github.auth)) {
  throw new Error("Expected app-token auth for GitHub");
}
const githubAppToken = github.auth;
```

TypeScript narrows `github.auth` to `AppTokenDef<GitHubConfig>` after the guard — no cast.

#### 2. Check other test files for similar patterns
**Files**: `linear/index.test.ts`, `sentry/index.test.ts`, `vercel/index.test.ts`
**Changes**: If any contain auth casts, apply the same type guard pattern. (Unlikely — only GitHub has the AppToken distinction.)

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Lint passes: `pnpm check`
- [ ] All tests pass: `pnpm --filter @repo/console-providers test`
- [ ] `github/index.test.ts` contains zero `as unknown as AppTokenDef` casts

---

## Testing Strategy

### Unit Tests:
- Existing `@repo/console-providers` tests cover auth methods, webhook verification, and event classification
- After Phase 5, the GitHub test uses type guards instead of casts — same coverage, better type safety
- No new unit tests needed — existing tests validate the runtime behavior

### Integration Tests:
- Gateway build (`pnpm --filter gateway build`) validates all imports and types resolve
- Full typecheck (`pnpm typecheck`) validates cross-package type consistency

### Manual Testing Steps:
1. GitHub App install flow: `/connections/github/authorize` → GitHub install UI → callback → token
2. OAuth flow: `/connections/linear/authorize` → Linear OAuth → callback → token storage
3. Token vault: `GET /connections/:id/token` returns valid token
4. API proxy: `POST /connections/:id/proxy/execute` with valid endpoint

## Performance Considerations

- `createProviderHandles()` is called once at cold start — closure creation is O(n providers), negligible
- BoundAuth closures add one function call layer vs direct `auth.method(config, ...)` — invisible in practice (auth methods make network calls)
- No runtime allocation per request — handles are module-level constants

## Cast Elimination Summary

| Category | Before | After | Method |
|----------|--------|-------|--------|
| `config as never` (connections.ts) | 8 | 0 | BoundAuth closures |
| `auth as OAuthDef/AppTokenDef<never>` | 2 | 0 | BoundAuth discriminated union |
| `providerDef as ProviderDefinition` | 3 | 0 | ProviderHandle.def |
| `env as unknown as Record<string,string>` | 1 | 0 | Widen createConfig param |
| Factory return casts | 2 | 0 | Type-annotated result variable |
| `envSchema as Record<string, ZodType<string>>` | 1 | 0 | Constrain envSchema type |
| `typedEntityHandler` return | 1 | 0 (2 internal) | Adapter wrapper |
| `Object.entries` event cast | 1 | 1 (widening) | Cast at iteration level |
| EVENT_REGISTRY return | 1 | 1 | **Unavoidable** — documented |
| `getProvider` string overload | 1 | 0 | `isProviderName` type guard |
| Test auth double cast | 1 | 0 | `isAppTokenAuth()` guard |
| **Total** | **22** | **2** (1 unavoidable + 1 safe widening) + 2 internal adapter casts | |

**Net result**: From 22 casts to 2 visible casts (both documented, both safe) + 2 internal adapter casts (structurally sound, hidden from callers).

## References

- Research: `thoughts/shared/research/2026-03-18-type-cast-elimination-oauth-provider.md`
- Synthesis: `thoughts/shared/research/2026-03-18-provider-architecture-synthesis.md`
- Existing plan: `thoughts/shared/plans/2026-03-18-provider-architecture-redesign.md`
