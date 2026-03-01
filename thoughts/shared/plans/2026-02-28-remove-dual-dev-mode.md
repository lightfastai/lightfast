# Remove Dual Dev Mode from All Apps

## Overview

Remove the legacy `@lightfastai/dual` CLI-based env loading (`dual run --`) from all 4 apps (auth, www, console, chat). The `with-env:dev` script and all references to it are removed entirely. The `.dual/` directory at the repo root is the new system and remains untouched.

## Current State Analysis

All 4 apps have identical patterns:
- `"with-env:dev": "dual run --"` script in `package.json`
- `dev` and `build:dev` scripts chain through `pnpm with-env:dev`
- Root `package.json` has `@lightfastai/dual: ^1.2.2` devDependency
- `with-env:prod` uses `dotenv-cli` and is **not** being changed

### Key Discoveries:
- `apps/auth/package.json:15` — `"with-env:dev": "dual run --"`
- `apps/www/package.json:20` — `"with-env:dev": "dual run --"`
- `apps/console/package.json:19` — `"with-env:dev": "dual run --"`
- `apps/chat/package.json:15` — `"with-env:dev": "dual run --"`
- `package.json:60` — `"@lightfastai/dual": "^1.2.2"` root devDependency
- `apps/www/package.json:17-19` — cms scripts also use `with-env:dev`
- `apps/chat/package.json:17-24` — eval scripts also use `with-env:dev`

## Desired End State

- No `with-env:dev` script exists in any app's `package.json`
- No `pnpm with-env:dev` prefix in any script across the repo
- `@lightfastai/dual` removed from root `devDependencies`
- `.dual/` directory remains untouched (new system)
- `with-env:prod` (dotenv-cli) remains untouched
- All scripts run commands directly without env wrapper

### Verification:
- `grep -r "with-env:dev" apps/` returns no results
- `grep -r "dual run" apps/` returns no results
- `grep "lightfastai/dual" package.json` returns no results
- `pnpm install` succeeds
- `pnpm lint` passes
- `pnpm typecheck` passes

## What We're NOT Doing

- NOT removing the `.dual/` directory (that's the new system)
- NOT changing `with-env:prod` or `dotenv-cli` usage
- NOT touching the `with-dual-auth.ts` file in console (that's authentication logic, unrelated)
- NOT removing `dotenv-cli` from any app's devDependencies (still needed for `with-env:prod`)

## Implementation Approach

Single phase — straightforward script removal across 5 files.

## Phase 1: Remove Dual Dev Mode

### Overview
Remove all `dual run --` references from the 4 apps and the root dependency.

### Changes Required:

#### 1. `apps/auth/package.json`
**Remove**: `"with-env:dev": "dual run --"` script
**Update**: Remove `pnpm with-env:dev` prefix from scripts:

| Script | Before | After |
|--------|--------|-------|
| `build:dev` | `pnpm with-env:dev next build --turbopack` | `next build --turbopack` |
| `dev` | `... && pnpm with-env:dev next dev --port $(microfrontends port) --turbo` | `... && next dev --port $(microfrontends port) --turbo` |

#### 2. `apps/www/package.json`
**Remove**: `"with-env:dev": "dual run --"` script
**Update**: Remove `pnpm with-env:dev` prefix from scripts:

| Script | Before | After |
|--------|--------|-------|
| `build:dev` | `pnpm with-env:dev next build --turbopack` | `next build --turbopack` |
| `dev` | `... && pnpm with-env:dev next dev --port $(microfrontends port) --turbopack` | `... && next dev --port $(microfrontends port) --turbopack` |
| `cms:types` | `pnpm with-env:dev pnpm --filter @vendor/cms exec basehub generate` | `pnpm --filter @vendor/cms exec basehub generate` |
| `cms:dev` | `pnpm with-env:dev pnpm --filter @vendor/cms exec basehub dev` | `pnpm --filter @vendor/cms exec basehub dev` |
| `cms:analyze` | `pnpm with-env:dev pnpm --filter @vendor/cms exec basehub` | `pnpm --filter @vendor/cms exec basehub` |

#### 3. `apps/console/package.json`
**Remove**: `"with-env:dev": "dual run --"` script
**Update**: Remove `pnpm with-env:dev` prefix from scripts:

| Script | Before | After |
|--------|--------|-------|
| `build:dev` | `pnpm with-env:dev next build --turbopack` | `next build --turbopack` |
| `dev` | `... && pnpm with-env:dev next dev --port $(microfrontends port) --turbo` | `... && next dev --port $(microfrontends port) --turbo` |

#### 4. `apps/chat/package.json`
**Remove**: `"with-env:dev": "dual run --"` script
**Update**: Remove `pnpm with-env:dev` prefix from scripts:

| Script | Before | After |
|--------|--------|-------|
| `build:dev` | `pnpm with-env:dev next build --turbopack` | `next build --turbopack` |
| `dev` | `pnpm with-env:dev next dev --turbopack --port ${NEXT_PUBLIC_CHAT_PORT:-4106}` | `next dev --turbopack --port ${NEXT_PUBLIC_CHAT_PORT:-4106}` |
| `eval:citations` | `pnpm with-env:dev npx braintrust eval ...` | `npx braintrust eval ...` |
| `eval:concise` | `pnpm with-env:dev npx braintrust eval ...` | `npx braintrust eval ...` |
| `eval:tool-calls` | `pnpm with-env:dev npx braintrust eval ...` | `npx braintrust eval ...` |
| `eval:tool-repair` | `pnpm with-env:dev npx braintrust eval ...` | `npx braintrust eval ...` |
| `eval:general-qa` | `pnpm with-env:dev npx braintrust eval ...` | `npx braintrust eval ...` |
| `eval:security` | `pnpm with-env:dev npx braintrust eval ...` | `npx braintrust eval ...` |
| `eval:all` | `pnpm with-env:dev npx braintrust eval ...` | `npx braintrust eval ...` |
| `eval:tools` | `pnpm with-env:dev npx braintrust eval ...` | `npx braintrust eval ...` |

#### 5. Root `package.json`
**Remove**: `"@lightfastai/dual": "^1.2.2"` from `devDependencies`

### Success Criteria:

#### Automated Verification:
- [ ] No references to `with-env:dev` in any app: `grep -r "with-env:dev" apps/` returns empty
- [ ] No references to `dual run` in any app: `grep -r "dual run" apps/` returns empty
- [ ] No `@lightfastai/dual` in root deps: `grep "lightfastai/dual" package.json` returns empty
- [ ] `pnpm install` succeeds after removing the dependency
- [ ] Linting passes: `pnpm lint`
- [ ] Type checking passes: `pnpm typecheck`

#### Manual Verification:
- [ ] `pnpm dev:app` starts all apps correctly
- [ ] `pnpm dev:chat` starts chat correctly
- [ ] `.dual/` directory contents are unchanged

## References

- Root `package.json` — dual devDependency
- `.dual/settings.json` — new dual system config (not modified)
- `.dual/hooks/nextjs-apps-port-remap.sh` — new dual hook (not modified)
