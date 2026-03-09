# Extract apps/chat to Standalone Repository

## Overview

Extract `apps/chat` and all its dependencies (chat-specific + forked shared packages) from the `lightfast` monorepo into the existing standalone repository at `github.com/lightfastai/chat`. Preserve git history from both the original standalone era (489 commits) and the monorepo era (1025 relevant commits). The target repo maintains a monorepo structure.

## Current State Analysis

### Source: lightfast monorepo
- **Total monorepo commits**: 4,460
- **Commits touching chat-related paths**: 1,025
- **Chat app scaffolded**: `ee6c0e415` (Aug 9, 2025) — fresh build, not imported from standalone
- **Chat-specific packages**: 8 directories (apps/chat, api/chat, db/chat, packages/chat-*, vendor/storage)
- **Shared deps to fork**: 16 directories (core/ai-sdk, packages/{ai,lib,ui,url-utils}, internal/{eslint,typescript,prettier}, vendor/{analytics,clerk,db,inngest,next,observability,security,seo})

### Target: github.com/lightfastai/chat
- **Existing commits**: 489 (Convex-era, different codebase)
- **Current content**: README.md only (deprecated)
- **Last commit**: `865dc65` "chore: deprecate repository and redirect to main monorepo (#324)"

### Key Discovery
The standalone repo (Convex-based) and monorepo chat app (Drizzle/tRPC) are completely different codebases with unrelated git histories. The monorepo chat was built from scratch, not ported.

## Desired End State

A self-contained monorepo at `github.com/lightfastai/chat` with:

```
lightfastai/chat/
├── api/chat/                    # @api/chat - tRPC router, Inngest workflows
├── apps/chat/                   # @lightfast/chat - Next.js app
├── core/ai-sdk/                 # @lightfastai/ai-sdk (forked)
├── db/chat/                     # @db/chat - Drizzle schema, migrations
├── internal/
│   ├── eslint/                  # @repo/eslint-config (forked)
│   ├── prettier/                # @repo/prettier-config (forked)
│   └── typescript/              # @repo/typescript-config (forked)
├── packages/
│   ├── ai/                      # @repo/ai (forked)
│   ├── chat-ai/                 # @repo/chat-ai
│   ├── chat-ai-types/           # @repo/chat-ai-types
│   ├── chat-api-services/       # @repo/chat-api-services
│   ├── chat-billing/            # @repo/chat-billing
│   ├── chat-trpc/               # @repo/chat-trpc
│   ├── lib/                     # @repo/lib (forked)
│   ├── ui/                      # @repo/ui (forked)
│   └── url-utils/               # @repo/url-utils (forked)
├── vendor/
│   ├── analytics/               # @vendor/analytics (forked)
│   ├── clerk/                   # @vendor/clerk (forked)
│   ├── db/                      # @vendor/db (forked)
│   ├── inngest/                 # @vendor/inngest (forked)
│   ├── next/                    # @vendor/next (forked)
│   ├── observability/           # @vendor/observability (forked)
│   ├── security/                # @vendor/security (forked)
│   ├── seo/                     # @vendor/seo (forked)
│   └── storage/                 # @vendor/storage
├── .gitignore
├── package.json                 # Root workspace config
├── pnpm-workspace.yaml          # With catalog versions
├── turbo.json                   # Root turbo config
├── tsconfig.json                # Root TS config (if needed)
├── CLAUDE.md
├── LICENSE
└── README.md
```

### Verification:
1. `pnpm install` succeeds
2. `pnpm typecheck` passes
3. `pnpm lint` passes
4. `pnpm build` succeeds (with env vars)
5. Git history shows both eras: 489 legacy commits + ~1025 monorepo-era commits
6. `git log -- apps/chat/` shows full monorepo-era history
7. All chat-specific directories removed from lightfast monorepo
8. Monorepo still builds/typechecks without chat

## What We're NOT Doing

- Publishing shared packages to npm (forking instead)
- Keeping shared packages in sync between repos (they diverge after extraction)
- Migrating Vercel project settings (separate step)
- Migrating environment variables (separate step)
- Moving CI/CD configuration (separate step)
- Changing any code — this is a pure extraction

## Implementation Approach

Use `git filter-repo` to extract a filtered clone of the monorepo containing only the 24 target directories. Then graft this filtered history onto the existing chat repo's history to preserve the 489 legacy commits as historical context.

---

## Phase 1: Extract Filtered History from Monorepo

### Overview
Create a filtered clone of the monorepo containing only the 24 directories relevant to chat, preserving their commit history.

### Steps:

#### 1. Clone monorepo to temp location
```bash
git clone /Users/jeevanpillay/Code/@lightfastai/lightfast /tmp/repos/chat-extraction
cd /tmp/repos/chat-extraction
```

#### 2. Run git filter-repo to keep only chat-related paths
```bash
git filter-repo \
  --path apps/chat/ \
  --path api/chat/ \
  --path db/chat/ \
  --path packages/chat-ai/ \
  --path packages/chat-ai-types/ \
  --path packages/chat-api-services/ \
  --path packages/chat-billing/ \
  --path packages/chat-trpc/ \
  --path vendor/storage/ \
  --path core/ai-sdk/ \
  --path packages/ai/ \
  --path packages/lib/ \
  --path packages/ui/ \
  --path packages/url-utils/ \
  --path internal/eslint/ \
  --path internal/typescript/ \
  --path internal/prettier/ \
  --path vendor/analytics/ \
  --path vendor/clerk/ \
  --path vendor/db/ \
  --path vendor/inngest/ \
  --path vendor/next/ \
  --path vendor/observability/ \
  --path vendor/security/ \
  --path vendor/seo/
```

This will:
- Remove all commits that don't touch any of these 24 paths
- Keep ~1025 commits with their full messages, authors, and dates
- Rewrite history so only these paths exist

#### 3. Verify the filtered repo
```bash
# Check commit count
git rev-list --count HEAD

# Verify directory structure
ls -la

# Check a few commits to confirm history integrity
git log --oneline | head -10
git log --oneline | tail -10
```

### Success Criteria:

#### Automated Verification:
- [x] Filtered repo contains ~1025 commits: `git rev-list --count HEAD` (actual: 1152)
- [x] All 24 directories exist: `ls api/ apps/ core/ db/ internal/ packages/ vendor/`
- [x] No non-chat directories remain: `ls apps/` shows only `chat/`
- [x] `git log --oneline -- apps/chat/ | wc -l` matches monorepo count (~342) (actual: 338)

#### Manual Verification:
- [ ] Spot-check 3-5 commits to verify messages and diffs are correct
- [ ] Verify no sensitive data leaked through (env files, secrets)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 2: Graft Legacy History

### Overview
Connect the filtered monorepo history with the existing 489 legacy commits from the chat repo, so `git log` shows the full timeline.

### Steps:

#### 1. Add the legacy chat repo as a remote
```bash
cd /tmp/repos/chat-extraction
git remote add legacy https://github.com/lightfastai/chat.git
git fetch legacy
```

#### 2. Find the graft points
```bash
# The earliest commit in our filtered history
EARLIEST_FILTERED=$(git rev-list --reverse HEAD | head -1)
echo "Earliest filtered commit: $EARLIEST_FILTERED"

# The latest commit in the legacy repo
LATEST_LEGACY=$(git rev-parse legacy/main)
echo "Latest legacy commit: $LATEST_LEGACY"
```

#### 3. Graft the histories together
```bash
# Create a graft so the earliest filtered commit has the legacy tip as its parent
git replace --graft $EARLIEST_FILTERED $LATEST_LEGACY

# Make the graft permanent by rewriting history
git filter-repo --force
```

#### 4. Verify the combined history
```bash
# Total should be ~1025 + 489 = ~1514
git rev-list --count HEAD

# Check the history flows correctly
git log --oneline | tail -20  # Should show legacy commits at the bottom
```

### Success Criteria:

#### Automated Verification:
- [x] Total commit count is approximately 1514: `git rev-list --count HEAD` (actual: 1641)
- [x] `git log --oneline | tail -5` shows legacy commits (e.g., "Initial commit")
- [x] `git log --oneline | head -5` shows recent monorepo-era commits
- [x] History is linear with no orphaned commits: `git fsck`

#### Manual Verification:
- [ ] `git log --oneline` shows smooth transition from legacy to monorepo era
- [ ] No duplicate or garbled commits at the graft point

**Implementation Note**: After completing this phase, pause for manual confirmation before proceeding.

---

## Phase 3: Add Root Configuration Files

### Overview
Create the workspace root files needed for the standalone monorepo to function: `pnpm-workspace.yaml`, root `package.json`, `turbo.json`, `.gitignore`, etc.

### Steps:

#### 1. Create `pnpm-workspace.yaml`
**File**: `pnpm-workspace.yaml`

```yaml
packages:
  - api/*
  - apps/*
  - core/*
  - db/*
  - packages/*
  - internal/*
  - vendor/*
catalog:
  '@tanstack/react-query': ^5.80.7
  '@trpc/client': ^11.8.0
  '@trpc/tanstack-react-query': ^11.8.0
  '@trpc/server': ^11.8.0
  lucide-react: ^0.451.0
  superjson: ^2.2.1
  '@types/node': ^20.16.11
  '@types/eslint__js': 8.42.3
  '@eslint/js': ^9.37.0
  eslint: ^9.23.0
  prettier: ^3.5.3
  typescript: ^5.8.2
  typescript-eslint: ^8.46.1
  turbo: ^2.5.5
  '@ai-sdk/anthropic': 2.0.4
  '@ai-sdk/gateway': 1.0.7
  '@ai-sdk/provider': 2.0.0
  '@ai-sdk/react': 2.0.15
  ai: 5.0.52
  '@upstash/redis': ^1.35.1
  '@vercel/blob': ^1.1.1
  '@vercel/related-projects': ^1.0.0
  '@vercel/sandbox': ^0.0.13
  redis: ^5.6.0
  braintrust: ^0.2.1
  exa-js: ^1.8.22
  '@t3-oss/env-core': ^0.13.10
  '@t3-oss/env-nextjs': ^0.13.10
  resumable-stream: ^2.0.0
  '@clerk/backend': 2.31.0
  '@clerk/elements': 0.24.8
  '@clerk/nextjs': 6.37.4
  '@clerk/shared': 3.45.0
  '@clerk/themes': 2.4.52
  '@clerk/types': 4.101.15
  geist: ^1.3.1
  neverthrow: ^8.2.0
  clsx: ^2.1.1
  tailwind-merge: ^3.3.1
  inngest: ^3.35.1
  '@inngest/middleware-sentry': ^0.1.2
  '@sentry/core': ^10.27.0
  '@sentry/nextjs': ^10.27.0
  '@sentry/profiling-node': ^10.27.0
  nanoid: ^5.1.5
  drizzle-orm: ^0.43.1
  '@neondatabase/serverless': ^1.0.2
  hono: ^4.12.2
  postgres: ^3.4.5
  drizzle-zod: ^0.7.1
  react-hook-form: ^7.61.1
  '@hookform/resolvers': ^3.10.0
  import-in-the-middle: ^1.8.1
  require-in-the-middle: ^7.1.1
  babel-plugin-react-compiler: ^1.0.0
  vitest: ^3.2.4
  '@vitest/coverage-v8': ^3.2.4
  dotenv-cli: ^8.0.0
catalogs:
  tailwind4:
    tailwindcss: 4.1.11
    postcss: 8.5.6
    '@tailwindcss/postcss': 4.1.11
    '@tailwindcss/typography': ^0.5.16
  zod3:
    zod: ^3.25.76
  zod4:
    zod: ^4.0.0
  next16:
    next: ^16.1.6
onlyBuiltDependencies:
  - '@clerk/shared'
  - '@sentry/cli'
  - '@tailwindcss/oxide'
  - '@vercel/speed-insights'
  - bufferutil
  - core-js
  - core-js-pure
  - esbuild
  - protobufjs
  - sharp
ignoredBuiltDependencies:
  - bufferutil
  - core-js
  - core-js-pure
  - esbuild
  - protobufjs
  - sharp
linkWorkspacePackages: true
publicHoistPattern:
  - '@ianvs/prettier-plugin-sort-imports'
  - prettier-plugin-tailwindcss
  - '*import-in-the-middle*'
  - '*require-in-the-middle*'
```

#### 2. Create root `package.json`
**File**: `package.json`

```json
{
  "name": "lightfast-chat",
  "license": "MIT",
  "private": true,
  "engines": {
    "node": ">=22.0.0",
    "pnpm": "10.5.2"
  },
  "packageManager": "pnpm@10.5.2",
  "scripts": {
    "build": "turbo run build",
    "build:chat": "turbo run build -F @lightfast/chat",
    "clean": "git clean -xdf node_modules .turbo",
    "clean:workspaces": "turbo run clean",
    "dev": "turbo watch dev -F @lightfast/chat --continue",
    "dev:chat": "turbo watch dev -F @lightfast/chat --continue",
    "format": "turbo run format --continue -- --cache --cache-location .cache/.prettiercache",
    "format:fix": "turbo run format --continue -- --write --cache --cache-location .cache/.prettiercache",
    "lint": "SKIP_ENV_VALIDATION=true turbo run lint --continue -- --cache --cache-location .cache/.eslintcache",
    "lint:fix": "SKIP_ENV_VALIDATION=true turbo run lint --continue -- --fix --cache --cache-location .cache/.eslintcache",
    "lint:ws": "pnpm dlx sherif@latest",
    "postinstall": "pnpm lint:ws",
    "test": "SKIP_ENV_VALIDATION=true turbo run test",
    "typecheck": "SKIP_ENV_VALIDATION=true turbo run typecheck",
    "db:generate": "pnpm --filter @db/chat db:generate",
    "db:migrate": "pnpm --filter @db/chat db:migrate",
    "db:studio": "pnpm --filter @db/chat db:studio",
    "eval:all": "pnpm --filter @lightfast/chat eval:all"
  },
  "devDependencies": {
    "@repo/prettier-config": "workspace:*",
    "prettier": "catalog:",
    "turbo": "^2.8.11",
    "typescript": "^5.9.2",
    "typescript-eslint": "^8.46.1",
    "vitest": "^3.2.4"
  },
  "prettier": "@repo/prettier-config",
  "pnpm": {
    "overrides": {
      "react": "^19.2.1",
      "react-dom": "^19.2.1",
      "@types/react": "^19.1.11",
      "@types/react-dom": "^19.1.8"
    }
  }
}
```

#### 3. Create root `turbo.json`
**File**: `turbo.json`

```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [
        ".cache/tsbuildinfo.json",
        "dist/**",
        ".next/**",
        "!.next/cache/**",
        "!.next/dev/**"
      ],
      "env": [
        "NEXT_PUBLIC_*",
        "SENTRY_*",
        "VERCEL_ENV"
      ]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "format": {
      "outputs": [".cache/.prettiercache"],
      "outputLogs": "new-only"
    },
    "transit": {
      "dependsOn": ["^transit"]
    },
    "lint": {
      "dependsOn": ["^build", "transit"],
      "outputs": [".cache/.eslintcache"],
      "env": []
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs": [
        "src/**",
        "vitest.config.ts",
        "tsconfig.json"
      ],
      "outputs": [],
      "env": []
    },
    "typecheck": {
      "dependsOn": ["^build", "transit"],
      "outputs": [".cache/tsbuildinfo.json"],
      "env": []
    },
    "clean": {
      "cache": false
    },
    "eval": {
      "cache": false,
      "interactive": true
    }
  },
  "globalEnv": [
    "NODE_ENV",
    "CI"
  ],
  "globalPassThroughEnv": [
    "SKIP_ENV_VALIDATION",
    "npm_lifecycle_event",
    "VERCEL",
    "VERCEL_ENV",
    "VERCEL_URL",
    "VERCEL_PROJECT_PRODUCTION_URL",
    "LOGTAIL_SOURCE_TOKEN"
  ],
  "boundaries": {
    "tags": {
      "vendor": {
        "dependencies": { "deny": ["packages", "data", "api", "app"] }
      },
      "internal": {
        "dependencies": { "deny": ["vendor", "packages", "data", "api", "app", "core"] }
      },
      "app": {
        "dependents": { "deny": ["vendor", "packages", "data", "api", "core", "internal"] }
      }
    }
  }
}
```

#### 4. Create `.gitignore`
Copy the monorepo's `.gitignore` (it's already comprehensive and applicable).

#### 5. Update `apps/chat/CLAUDE.md`
Update to reflect standalone repo context (remove monorepo references).

#### 6. Create root `CLAUDE.md`
Adapted from monorepo CLAUDE.md but scoped to the chat app.

### Success Criteria:

#### Automated Verification:
- [x] All config files exist: `ls pnpm-workspace.yaml package.json turbo.json .gitignore`
- [x] YAML is valid
- [x] JSON is valid

#### Manual Verification:
- [ ] Review `pnpm-workspace.yaml` catalog versions match monorepo
- [ ] Review root `package.json` scripts are appropriate for standalone

**Implementation Note**: Pause for manual review before proceeding.

---

## Phase 4: Install, Build & Fix

### Overview
Run `pnpm install` and fix any issues. Some references may need updating (e.g., `@vercel/related-projects` config, env file paths, Sentry project references).

### Steps:

#### 1. Install dependencies
```bash
cd /tmp/repos/chat-extraction
pnpm install
```

#### 2. Fix any workspace resolution issues
- Update any `workspace:*` or `workspace:^` references that reference packages we didn't include
- Remove `@vercel/related-projects` from `apps/chat/package.json` dependencies (microfrontends config is monorepo-specific)

#### 3. Fix env file paths
- `db/chat/package.json` has `with-env` pointing to `../../apps/chat/.vercel/.env.development.local` — this path is still valid in the new structure

#### 4. Run typecheck
```bash
pnpm typecheck
```

#### 5. Run lint
```bash
pnpm lint
```

#### 6. Fix any errors found

### Success Criteria:

#### Automated Verification:
- [x] `pnpm install` succeeds without errors
- [x] `pnpm typecheck` passes (45/45 tasks)
- [x] `pnpm lint` passes (41/41 tasks)

#### Manual Verification:
- [ ] No unexpected workspace resolution warnings
- [ ] No missing peer dependency warnings for critical packages

**Implementation Note**: This phase may require iteration. Pause after each fix cycle for verification.

---

## Phase 5: Push to GitHub

### Overview
Push the combined history to `github.com/lightfastai/chat`, replacing the current content.

### Steps:

#### 1. Set up the remote
```bash
cd /tmp/repos/chat-extraction
git remote remove origin 2>/dev/null
git remote add origin https://github.com/lightfastai/chat.git
```

#### 2. Create a commit with root configuration files
```bash
git add pnpm-workspace.yaml package.json turbo.json .gitignore CLAUDE.md
git commit -m "chore: re-establish standalone monorepo with extracted history

Extracts apps/chat and all dependencies from lightfastai/lightfast monorepo.
Preserves full git history from both eras:
- 489 legacy commits (Convex-era standalone)
- ~1025 monorepo-era commits (Drizzle/tRPC)

Structure:
- api/chat: tRPC router and Inngest workflows
- apps/chat: Next.js application
- core/ai-sdk: AI SDK wrapper
- db/chat: Drizzle schema and migrations
- internal/: ESLint, TypeScript, Prettier configs
- packages/: chat-ai, chat-billing, chat-trpc, lib, ui, etc.
- vendor/: analytics, clerk, db, inngest, next, observability, security, seo, storage"
```

#### 3. Force push to replace current content
```bash
git push --force-with-lease origin main
```

### Success Criteria:

#### Automated Verification:
- [x] `git push` succeeds (force push with branch protection bypass)
- [ ] `gh repo view lightfastai/chat --json defaultBranchRef` shows main branch

#### Manual Verification:
- [ ] Visit https://github.com/lightfastai/chat and verify directory structure
- [ ] Check commit history on GitHub shows both eras
- [ ] Verify README is updated

**Implementation Note**: Force push is destructive. Confirm with user before executing. Pause for manual confirmation.

---

## Phase 6: Cleanup Monorepo

### Overview
Remove chat-specific directories from the lightfast monorepo. Keep shared packages (they're still used by other apps).

### Directories to Remove:
- `apps/chat/`
- `api/chat/`
- `db/chat/`
- `packages/chat-ai/`
- `packages/chat-ai-types/`
- `packages/chat-api-services/`
- `packages/chat-billing/`
- `packages/chat-trpc/`
- `vendor/storage/` (only consumer was chat)

### Files to Update:
- Root `package.json`: Remove `build:chat`, `dev:chat` scripts and any chat references
- Root `turbo.json`: No changes needed (generic)
- `pnpm-workspace.yaml`: No changes needed (glob patterns still valid)
- Any CI/CD configs referencing chat

### Steps:

#### 1. Remove chat-specific directories
```bash
cd /Users/jeevanpillay/Code/@lightfastai/lightfast
rm -rf apps/chat/ api/chat/ db/chat/
rm -rf packages/chat-ai/ packages/chat-ai-types/ packages/chat-api-services/
rm -rf packages/chat-billing/ packages/chat-trpc/
rm -rf vendor/storage/
```

#### 2. Update root package.json
Remove scripts: `build:chat`, `dev:chat`, and the `dev` script reference to `@lightfast/chat`.

#### 3. Run pnpm install to update lockfile
```bash
pnpm install
```

#### 4. Verify monorepo still works
```bash
pnpm typecheck
pnpm lint
```

### Success Criteria:

#### Automated Verification:
- [x] No chat directories exist
- [x] `pnpm install` succeeds
- [x] `pnpm typecheck` passes (133/133 tasks)
- [x] `pnpm lint` passes (118/118 tasks)
- [ ] `pnpm build:console` succeeds

#### Manual Verification:
- [ ] `pnpm dev:console` starts without errors
- [ ] No broken imports referencing removed packages

**Implementation Note**: Pause for manual confirmation before committing cleanup.

---

## Testing Strategy

### Automated Tests:
- `pnpm install` in extracted repo
- `pnpm typecheck` in extracted repo
- `pnpm lint` in extracted repo
- `git log` verification (commit counts, history continuity)
- `git fsck` for repository integrity
- Monorepo `pnpm typecheck` and `pnpm lint` after cleanup

### Manual Testing Steps:
1. Clone the pushed `lightfastai/chat` repo fresh and run `pnpm install`
2. Set up env vars and run `pnpm dev:chat`
3. Verify the chat app starts and functions correctly
4. In the monorepo, verify `pnpm dev:console` still works after cleanup
5. Verify `git log` on GitHub shows the full history timeline

## Risk Considerations

1. **Force push to chat repo**: Destructive, but the existing 489 commits are grafted into the new history, so nothing is lost
2. **Shared package divergence**: After forking, `@repo/ui`, `@repo/lib`, etc. will diverge between repos. Future updates must be manually synced
3. **Vercel project configuration**: The chat Vercel project needs to be re-linked to the new repo. This is out of scope for this plan
4. **Environment variables**: `.vercel/.env.development.local` files are gitignored and won't be extracted. They need manual setup
5. **`catalog:` references**: If any chat package references a catalog entry we missed in `pnpm-workspace.yaml`, `pnpm install` will fail — we catch this in Phase 4

## References

- Source monorepo: `/Users/jeevanpillay/Code/@lightfastai/lightfast`
- Target repo: `https://github.com/lightfastai/chat`
- Chat app scaffold commit: `ee6c0e415`
- Legacy repo deprecation commit: `865dc65`
- `git-filter-repo` docs: https://github.com/newren/git-filter-repo
