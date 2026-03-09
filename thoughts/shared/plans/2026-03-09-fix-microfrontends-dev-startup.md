# Fix Microfrontends Dev Startup Implementation Plan

## Overview

When running `pnpm dev:app`, the www and auth apps fail to start because Turborepo's `@vercel/microfrontends` integration auto-injects a `proxy` task that doesn't exist in console's scripts, and the `dev:ngrok` task resolves to the wrong package due to a name collision.

## Current State Analysis

### Turbo dry-run reveals two `<NONEXISTENT>` commands:

1. **`@lightfast/console#proxy`** — Auto-injected by `@vercel/microfrontends` Turbo integration as a `with` dependency for all 3 microfrontend apps (console, www, auth). Console has no `proxy` script in its `package.json`.

2. **`lightfast#dev:ngrok`** — Resolves to `core/lightfast/` (the SDK package) instead of the root monorepo package. Both have `"name": "lightfast"` in their `package.json`. The SDK package has no `dev:ngrok` script.

### Key file references:
- Root `package.json:22` — `dev:app` script with explicit `--filter` for all 6 apps
- `apps/console/package.json:12` — Console dev script (no proxy, no `VC_MICROFRONTENDS_CONFIG`)
- `apps/console/turbo.json:72` — `dev.with` array referencing `lightfast#dev:ngrok`
- `apps/www/package.json:12` — www dev script (sets `VC_MICROFRONTENDS_CONFIG`, uses `$(microfrontends port)`)
- `apps/auth/package.json:11` — auth dev script (same pattern as www)
- `apps/console/microfrontends.json` — Defines 3 apps: console (4107), www (4101), auth (4104)
- `core/lightfast/package.json:2` — SDK package with conflicting `"name": "lightfast"`

### Evidence from turbo dry-run:
```
@lightfast/console#proxy
  Command = <NONEXISTENT>
  Directory = apps/console

lightfast#dev:ngrok
  Command = <NONEXISTENT>
  Directory = core/lightfast    ← Wrong! Should be root
```

## Desired End State

Running `pnpm dev:app` starts all 6 apps successfully:
- Console (4107), www (4101), auth (4104) — Next.js microfrontend apps
- Relay (4108), backfill (4109), gateway (4110) — Hono services
- Microfrontends proxy on port 3024 — unified entry point
- Inngest, QStash, ngrok, DB studio — companion services via `with`

Verification: `turbo run dev --filter=@lightfast/console --dry-run` shows no `<NONEXISTENT>` commands.

## What We're NOT Doing

- Renaming either `lightfast` package (root or SDK) — we only fix the turbo reference
- Changing www/auth dev scripts — they already work correctly with `VC_MICROFRONTENDS_CONFIG`
- Adding `VC_MICROFRONTENDS_CONFIG` to console's dev script — console auto-detects `microfrontends.json` in its own directory

## Implementation Approach

Two minimal, independent fixes. Each can be verified independently.

---

## Phase 1: Add Microfrontends Proxy Script

### Overview
Add the missing `proxy` script to console's package.json so the `@vercel/microfrontends` Turbo integration can start the development proxy.

### Changes Required:

#### 1. Console package.json
**File**: `apps/console/package.json`
**Changes**: Add `proxy` script to the scripts object

```json
{
  "scripts": {
    "proxy": "microfrontends proxy --port 3024",
    // ... existing scripts
  }
}
```

The `microfrontends` binary is provided by `@vercel/microfrontends` (already a dependency). It's available via pnpm's script PATH resolution. Port 3024 matches the ngrok tunnel configuration.

### Success Criteria:

#### Automated Verification:
- [x] Turbo dry-run shows no `<NONEXISTENT>` for proxy: `pnpm turbo run dev --filter=@lightfast/console --filter=@lightfast/www --filter=@lightfast/auth --dry-run 2>&1 | grep -A1 "proxy"`
- [x] The proxy command resolves correctly: `cd apps/console && pnpm exec microfrontends proxy --help`
- [ ] Type checking passes: `pnpm typecheck`

#### Manual Verification:
- [ ] Run `pnpm dev:app` and confirm all 3 Next.js apps start (console on 4107, www on 4101, auth on 4104)
- [ ] Confirm microfrontends proxy starts on port 3024
- [ ] Access `http://localhost:3024` and verify routing works (console routes, www marketing routes, auth sign-in routes)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Fix Root Package Reference for dev:ngrok

### Overview
Fix the `lightfast#dev:ngrok` reference that resolves to `core/lightfast/` instead of the root package. Use Turborepo's `//` root reference syntax.

### Changes Required:

#### 1. Console turbo.json — Fix `with` reference
**File**: `apps/console/turbo.json`
**Changes**: Change `lightfast#dev:ngrok` to `//#dev:ngrok`

```json
{
  "tasks": {
    "dev": {
      "persistent": true,
      "with": [
        "@lightfast/console#dev:inngest",
        "@lightfast/console#dev:qstash",
        "//#dev:ngrok",
        "@db/console#dev:studio"
      ]
    }
  }
}
```

#### 2. Root turbo.json — Register root task
**File**: `turbo.json`
**Changes**: Add `//#dev:ngrok` task definition for root-specific registration

```json
{
  "tasks": {
    "//#dev:ngrok": {
      "cache": false,
      "persistent": true
    },
    // ... existing tasks
  }
}
```

The existing generic `dev:ngrok` task definition handles workspace packages; the `//#dev:ngrok` entry specifically registers it for root package references.

### Success Criteria:

#### Automated Verification:
- [x] Turbo dry-run shows correct directory for dev:ngrok: `pnpm turbo run dev --filter=@lightfast/console --dry-run 2>&1 | grep -A2 "dev:ngrok"` — should show root directory, NOT `core/lightfast`
- [x] No `<NONEXISTENT>` commands in full dry-run: `pnpm turbo run dev --filter=@lightfast/console --dry-run 2>&1 | grep "NONEXISTENT"` — should return empty
- [ ] Type checking passes: `pnpm typecheck`

#### Manual Verification:
- [ ] Run `pnpm dev:app` and confirm ngrok tunnel starts on port 3024
- [ ] Verify ngrok is tunneling to the microfrontends proxy: `ps aux | grep ngrok | grep -v grep`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

---

## Testing Strategy

### Automated:
- Turbo dry-run validation (no `<NONEXISTENT>` commands)
- All existing builds and typechecks pass

### Manual Testing Steps:
1. Run `pnpm dev:app`
2. Wait for all services to start (check turbo TUI output)
3. Open `http://localhost:3024` — should route to console
4. Open `http://localhost:3024/sign-in` — should route to auth app
5. Open `http://localhost:3024/` — should route to www marketing
6. Verify ngrok is running: `ps aux | grep ngrok`

## References

- Turbo dry-run output showing `<NONEXISTENT>` tasks
- [Turborepo: Registering Root Tasks](https://turborepo.dev/docs/crafting-your-repository/configuring-tasks#registering-root-tasks) — `//#task` syntax
- `@vercel/microfrontends proxy --help` — CLI usage
- `apps/console/microfrontends.json` — microfrontend app definitions
