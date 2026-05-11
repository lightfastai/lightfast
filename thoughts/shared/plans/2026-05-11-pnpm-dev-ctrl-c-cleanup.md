# `pnpm dev` Ctrl+C Cleanup Implementation Plan

## Overview

Make Ctrl+C against `pnpm dev` (and the `dev:app` / `dev:platform` / `dev:www` variants) reliably terminate the entire spawned process tree — including the three `next dev` workers, their compiler subprocesses, the `microfrontends proxy`, and the `portless run` route stub. The fix lands in `@lightfastai/dev-harness` (`@lightfastai/dev-cli` and `@lightfastai/dev-proxy`), then is rolled into this repo by bumping the catalog and trimming the redundant signal-forwarding layer in `scripts/dev-services.mjs`.

The persistent Portless HTTPS daemon on `:443` is intentionally out of scope — it's a system-level service started by `spawnSync("portless proxy start ...")` and is supposed to survive across `pnpm dev` runs.

## Current State Analysis

`pnpm dev` resolves (from `package.json:17`) to:

```
node scripts/dev-services.mjs inngest-sync --register-app … -- \
  lightfast-dev proxy turbo --local-app … run dev --concurrency=15 \
  -F @lightfast/www -F @lightfast/app -F @lightfast/platform --continue
```

Spawn tree on darwin:

```
sh -c "pnpm dev"  (TTY foreground pgrp)
└─ pnpm dev
   └─ node scripts/dev-services.mjs               ← SIGINT/SIGTERM handler: scripts/dev-services.mjs:322-339
      └─ lightfast-dev proxy turbo …              ← waitForRuntime: dev-harness/packages/dev-cli/src/main.ts:582-598
         ├─ microfrontends proxy …                (aux; binds localProxyPort)
         ├─ portless run … -- node -e setInterval (aux; route stub — detached by portless cli at portless/dist/cli.js:1660)
         └─ turbo run dev …
            ├─ next dev (app)        → webpack/turbopack worker subprocesses
            ├─ next dev (www)        → webpack/turbopack worker subprocesses
            └─ next dev (platform)   → webpack/turbopack worker subprocesses
```

Plus, **out of scope and intentionally persistent**: the Portless HTTPS daemon on `:443`, started by `dev-harness/packages/dev-proxy/src/index.ts:754` via `spawnSync`.

### Why Ctrl+C is unreliable

**Bug A — auxiliary-exits-first race in `createLinkedRuntime`**
`dev-harness/packages/dev-proxy/src/runtime.ts:841-859`. The `auxiliaries[].on("exit")` handler synchronously calls `child.kill('SIGTERM')` on turbo and then `finish()`, which resolves `runtime.exit`. On Ctrl+C, all processes in the shared pgrp receive SIGINT simultaneously. The lightweight `portless run … node -e setInterval(...)` route stub and/or the microfrontends proxy exit within tens of milliseconds; turbo, which has to forward signals to three persistent `next dev` tasks, takes seconds. The runtime resolves while turbo is mid-shutdown, `dev-cli/src/main.ts:597` then calls `process.exit(result.exitCode)`, and turbo plus its grandchildren get reparented to init.

**Bug B — no process-group kills anywhere**
Every layer uses `child.kill(signal)` (single-PID). Nothing in `dev-cli`, `dev-proxy`, or `scripts/dev-services.mjs` uses `spawn(..., { detached: true })` + `process.kill(-pid, signal)` or `tree-kill`. When turbo dies before propagating, its `next dev` children orphan; when next dev itself is force-killed, its webpack/turbopack workers orphan.

**Bug C — cascading early `process.exit()`**
`scripts/dev-services.mjs:334-339` exits as soon as its child (`lightfast-dev`) reports exit. Combined with bug A, the entire parent chain unwinds in ~50ms while turbo is still draining persistent tasks. `--continue` (set in `package.json:17`) makes turbo's shutdown path messier.

The CLAUDE.md workaround `pkill -f "next dev"` is a manual fix for exactly these orphans.

### Key discoveries

- `createLinkedRuntime` runs at `dev-harness/packages/dev-proxy/src/runtime.ts:812-874`. The early-resolve happens on lines 841-852.
- `waitForRuntime` runs at `dev-harness/packages/dev-cli/src/main.ts:582-598`. It registers handlers with `process.once`, so a second Ctrl+C does **not** escalate — it just terminates Node via its default SIGINT behavior.
- `dev-harness/packages/dev-proxy/src/runtime.ts` has four spawn sites for child orchestration (lines 172, 213, 279, 397, 435 plus the `spawnWithFallback` helper at line 758). None pass `detached: true`.
- `portless run` already uses `detached: true` for the route stub (`portless/dist/cli.js:1660`), so the stub lives in its own pgrp regardless. We rely on portless's own signal forwarding from the `portless run` parent to the stub; this is the one cleanup edge we can only verify, not enforce.
- `dev-harness` has a vitest test layout: `packages/dev-proxy/test/index.test.ts`, `packages/dev-cli/test/index.test.ts`. We'll add focused tests for the new shutdown contract there.

## Desired End State

After this plan:

1. `pnpm dev`, wait for the three Next.js dev servers to compile, press Ctrl+C once → shell prompt returns within ~3-4 seconds and `pgrep -af "next dev|microfrontends|turbo|node -e setInterval"` returns empty. `lsof -i :443` still shows the persistent Portless daemon (expected); no other dev-related ports are bound.
2. Same scenario but Ctrl+C is pressed during a Turbopack recompile (caused by editing a file): same result — clean exit within the grace window.
3. A double Ctrl+C (second one within the 3s grace) escalates immediately to SIGKILL on every process group; shell prompt returns within ~500ms; no orphans.
4. Existing `dev-harness` vitest suites still pass plus three new tests covering the shutdown contract.

Verifying #1 and #2 is currently the manual workaround `pkill -f "next dev"`; after this plan that command should be unnecessary for normal use.

## What We're NOT Doing

- Not killing or modifying the Portless HTTPS daemon on `:443`. It's intentionally persistent; teardown is via `portless proxy stop` if needed.
- Not adding a `pnpm dev:teardown` / `dev:stop` script in this repo (per user direction — fix the root cause only).
- Not switching to a Windows-supporting strategy (e.g., `tree-kill`). The team's dev environment is darwin/linux; we use POSIX process groups. We will keep `child.kill(signal)` as the win32 fallback so the package still functions there for non-dev consumers.
- Not changing the Inngest dev-sync in-process runtime (`startInngestDevSync`) — it's a `setInterval` inside the dev-services.mjs Node process and dies with that process correctly.
- Not changing turbo's flags. `--continue --concurrency=15` stays.
- Not changing `with-desktop-env.mjs` — its shape is simpler (single child, no aux) and the existing exit handler is correct.

## Implementation Approach

The model after this plan is:

- **Every spawn from `dev-harness` uses `detached: true` on POSIX.** This makes each spawned child a process-group leader. The TTY no longer sends SIGINT to children directly — only the topmost script's pgrp gets it. The parent forwards explicitly to each child pgrp.
- **`createLinkedRuntime` never resolves on auxiliary exit alone.** It always waits for the main child's `exit` event, and only after sending a coordinated SIGTERM to every tracked process group does it `await` the actual exit. A 3-second grace timer escalates remaining groups to SIGKILL.
- **`waitForRuntime` uses `process.on` (not `process.once`)** so a second Ctrl+C short-circuits the grace and triggers immediate SIGKILL.
- **`scripts/dev-services.mjs` becomes a thin pass-through:** it still forwards signals to its child, but doesn't `process.exit()` ahead of the child draining (the child now drains correctly on its own).

## Sequencing — empirical verdict: Phase 5 alone is INSUFFICIENT

A second spike on 2026-05-11 applied just the Phase 5 §1 changes in-place and ran a real `pnpm dev` to compile-ready, then inspected the process tree. **Result: refuted.** With only the outer-wrapper fix, `lightfast-dev` (the outer `proxy turbo` parent) still exited during normal startup — *before* the user could press Ctrl+C — leaving the turbo + microfrontends-proxy + next-dev + portless-run subtree reparented to init (PPID 1) as orphans.

Evidence from the spike run:

- After all three apps reported "✓ Ready", a fresh `ps -A` showed turbo (PID 45120) with PPID 1 and the microfrontends proxy wrapper (PID 45093) with PPID 1. The outer `lightfast-dev proxy turbo …` parent that spawned them was already gone, as was `node scripts/dev-services.mjs` and the `pnpm dev` launcher PID 44771.
- SIGINT to orphan turbo 45120 cleaned its subtree (turbo *does* forward signals to next-dev correctly when it gets one). SIGINT to orphan microfrontends wrapper 45093 killed the wrapper but left its inner `cli.cjs` worker as a second-level orphan (PID 45119, PPID 1) until manually killed.

**Diagnosis**: the `createLinkedRuntime` aux-exit race (Phase 1 §3, bug A in the plan) fires during normal operation, not just on Ctrl+C — one of the auxiliaries (microfrontends proxy or one of the portless `run` chains) emits an `exit` event during/after compile, the existing handler resolves `runtime.exit` early, `dev-cli`'s `waitForRuntime` then calls `process.exit`, and the entire control chain unwinds while the worker subtree is still alive. Phase 5's `detached:true` + group-kill is moot once the outer wrapper is already dead — there is no one left to receive the user's SIGINT and propagate it.

**Recommendation for the implementer**: ship Phases 1–4 first. The dev-harness fixes are load-bearing, not nice-to-have. Phase 5 still ships (it's a correctness improvement for `scripts/dev-services.mjs` regardless), but it cannot be landed in isolation — it depends on Phases 1–4 to keep the outer wrapper alive long enough for its signal forwarding to do anything.

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient — the next phase starts only on user go-ahead.

---

## Phase 1: dev-proxy — process-group spawning and correct shutdown order

### Overview

Make every spawn in `packages/dev-proxy/src/runtime.ts` create a new process group on POSIX, rewrite `createLinkedRuntime` to await the main child's exit, and add a 3-second SIGKILL escalation. This is the single largest behavioral change in the plan.

### Changes Required

#### 1. New helper `killProcessGroup`

**File**: `dev-harness/packages/dev-proxy/src/runtime.ts`

Add near the top of the file (after imports):

```ts
function killProcessGroup(child: ChildProcess, signal: NodeJS.Signals): void {
  if (!child.pid || child.killed) return;
  if (process.platform === "win32") {
    child.kill(signal);
    return;
  }
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    // ESRCH: group is already gone. Anything else: best-effort fall back.
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ESRCH") {
      child.kill(signal);
    }
  }
}
```

#### 2. Pass `detached: true` at every spawn site

**File**: `dev-harness/packages/dev-proxy/src/runtime.ts`

Update every direct `spawn` and the `spawn` inside `spawnWithFallback` to include `detached: process.platform !== "win32"`. The four sites are:

- **Line 172** — `startDevProxyTurboCommand` (main turbo child)
- **Line 279** — `startDevProxyDevCommand` (main dev child)
- **Line 435** — `startDevProxyAppRuntimeCommand` (app runtime child)
- **Line 765** — inside `spawnWithFallback` (function declared at line 758; the actual `spawn(command, args, { ...options, ...commandOptions })` call is at line 765)

Lines 213 and 397 are `spawnWithFallback(...)` *callers*, not bare `spawn` sites — they automatically inherit `detached: true` via the merged options on line 765. Verified spread order is `{ ...options, ...commandOptions }`, so per-command overrides still win if a caller pins `detached` explicitly (none currently do).

Example for the turbo spawn:

```ts
const child = spawn(normalizedCommandArgs[0], normalizedCommandArgs.slice(1), {
  cwd: config.root,
  env: prepareDevCommandEnv(normalizedCommandArgs, proxyEnv),
  stdio,
  detached: process.platform !== "win32",
});
```

`spawnWithFallback` merges `options` and per-command `commandOptions`; the new field flows through both layers, so a caller that already pins `detached` would still win.

#### 3. Rewrite `createLinkedRuntime` to await the main child and escalate

**File**: `dev-harness/packages/dev-proxy/src/runtime.ts`
**Changes**: replace the body of `createLinkedRuntime` (lines 812-874) with a version that (a) never resolves on aux exit alone, (b) coordinates SIGTERM across all tracked groups, (c) waits for the main child's `exit` event, (d) escalates to SIGKILL after a 3s grace.

```ts
const SHUTDOWN_GRACE_MS = 3000;

function createLinkedRuntime(
  child: ChildProcess,
  auxiliary: ChildProcess | undefined | Array<ChildProcess | undefined>,
): DevProxyProcessRuntime {
  const auxiliaries = (Array.isArray(auxiliary) ? auxiliary : [auxiliary])
    .filter((value): value is ChildProcess => Boolean(value));
  const proxy = auxiliaries[0];

  let shuttingDown = false;
  let escalationTimer: NodeJS.Timeout | undefined;

  const childExited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolve) => child.once("exit", (code, signal) => resolve({ code, signal })),
  );
  const auxExited = auxiliaries.map(
    (aux) =>
      new Promise<void>((resolve) =>
        aux.once("exit", () => resolve()),
      ),
  );

  const broadcast = (signal: NodeJS.Signals) => {
    killProcessGroup(child, signal);
    for (const aux of auxiliaries) killProcessGroup(aux, signal);
  };

  const beginShutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      // Second invocation: escalate immediately.
      if (escalationTimer) clearTimeout(escalationTimer);
      broadcast("SIGKILL");
      return;
    }
    shuttingDown = true;
    broadcast(signal);
    escalationTimer = setTimeout(() => broadcast("SIGKILL"), SHUTDOWN_GRACE_MS);
    escalationTimer.unref();
  };

  // If an auxiliary dies unexpectedly (e.g. crash) while we're not shutting down,
  // tear the main child down too — but still await the main child's exit before
  // resolving runtime.exit, so the caller never returns with grandchildren alive.
  for (const aux of auxiliaries) {
    aux.once("exit", () => {
      if (shuttingDown) return;
      beginShutdown("SIGTERM");
    });
  }

  const exit = (async () => {
    const { code, signal } = await childExited;
    // Main child is gone; make sure all aux groups are too.
    if (!shuttingDown) beginShutdown("SIGTERM");
    await Promise.race([
      Promise.all(auxExited),
      new Promise<void>((resolve) => setTimeout(resolve, SHUTDOWN_GRACE_MS).unref()),
    ]);
    if (escalationTimer) clearTimeout(escalationTimer);
    return toExitResult(code, signal);
  })();

  return {
    child,
    proxy,
    auxiliaries,
    stop(signal = "SIGTERM") {
      beginShutdown(signal);
    },
    exit,
  };
}
```

#### 4. Apply the same treatment to `createSingleChildRuntime` — including escalation

**File**: `dev-harness/packages/dev-proxy/src/runtime.ts`
**Changes**: route `stop()` through `killProcessGroup` AND mirror the same 3-second-grace + SIGKILL-on-second-stop escalation from `createLinkedRuntime`, so the contract is consistent across runtime shapes. Without this, `startDevProxyRuntime` and `startDevProxyAppCommand` (which both use `createSingleChildRuntime`) would have no escalation path — a stubborn child could hang their consumers indefinitely.

```ts
function createSingleChildRuntime(child: ChildProcess): DevProxyProcessRuntime {
  let shuttingDown = false;
  let escalationTimer: NodeJS.Timeout | undefined;

  const exit = new Promise<ProcessExitResult>((resolve) => {
    child.once("exit", (code, signal) => {
      if (escalationTimer) clearTimeout(escalationTimer);
      resolve(toExitResult(code, signal));
    });
  });

  return {
    child,
    stop(signal = "SIGTERM") {
      if (shuttingDown) {
        if (escalationTimer) clearTimeout(escalationTimer);
        killProcessGroup(child, "SIGKILL");
        return;
      }
      shuttingDown = true;
      killProcessGroup(child, signal);
      escalationTimer = setTimeout(
        () => killProcessGroup(child, "SIGKILL"),
        SHUTDOWN_GRACE_MS,
      );
      escalationTimer.unref();
    },
    exit,
  };
}
```

Hoist `SHUTDOWN_GRACE_MS` to module scope so both runtime constructors share it.

#### 5. Fix the start-up error path

**File**: `dev-harness/packages/dev-proxy/src/runtime.ts`
**Changes**: in `startDevProxyTurboCommand`'s catch block (lines 158-165), replace `proxy.kill("SIGTERM")` and `route.kill("SIGTERM")` (two kill calls, two different local variable names — `proxy` and `route`, not `proc`) with `killProcessGroup(proxy, "SIGTERM")` and `killProcessGroup(route, "SIGTERM")` so a failed startup also tears down by group. Keep the existing `!proxy.killed` / `!route.killed` guards (or rely on `killProcessGroup`'s own `child.killed` check — it handles both).

#### 6. Internal export entry for tests

**File**: `dev-harness/packages/dev-proxy/src/runtime-internal.ts` (new)
**Changes**: `createLinkedRuntime`, `createSingleChildRuntime`, and the new `killProcessGroup` are currently unexported `function` declarations in `runtime.ts` (verified at lines 786 and 812). Phase 3's tests cannot import them as written. Two-step fix:

1. Add `export` to the function declarations of `createLinkedRuntime`, `createSingleChildRuntime`, and `killProcessGroup` in `runtime.ts`. These symbols become importable *within* the package; the package's public API surface is governed by `package.json` exports map (which only lists the main entry), so external consumers gain nothing.
2. Create `runtime-internal.ts` with explicit re-exports of these three symbols:

```ts
export {
  createLinkedRuntime,
  createSingleChildRuntime,
  killProcessGroup,
} from "./runtime.js";
```

Phase 3's tests import from `../src/runtime-internal.js` — the explicit indirection signals "test-only access" to any future reader.

#### 7. Behavioral note — exit code semantics change

The Phase-1 §3 rewrite changes `runtime.exit`'s exit code when an auxiliary crashes mid-run.

- **Before**: aux's exit code propagated via the early-resolve race.
- **After**: main child's exit code propagates after the coordinated teardown completes.

This is intentional — a crashed aux should not mask the main child's natural exit signal — but it is a public-behavior change for consumers that branch on the integer exit code. None of the in-repo consumers (`waitForRuntime` in dev-cli, no third-party consumers known) do this today. Add a single line to the changeset call-out.

### Success Criteria

#### Automated Verification

- [x] Type checks pass: `pnpm -F @lightfastai/dev-proxy typecheck` (from `dev-harness/`)
- [x] Existing tests pass: `pnpm -F @lightfastai/dev-proxy test`
- [x] Build succeeds: `pnpm -F @lightfastai/dev-proxy build`

#### Human Review

- [ ] Re-read `createLinkedRuntime` end-to-end and confirm: (a) aux exit during normal shutdown does not race the main child, (b) aux exit outside shutdown triggers shutdown but still awaits main child, (c) double `stop()` escalates to SIGKILL. — TODO: automate via the Phase 3 tests; this human check disappears once those land.

---

## Phase 2: dev-cli — escalate on second Ctrl+C; drain before exit

### Overview

`waitForRuntime` in `dev-cli` already `await`s `runtime.exit`. With Phase 1, that wait is now correct (it includes the full process tree). The remaining gap is the lack of escalation on a stuck shutdown: `process.once` means the second SIGINT just terminates Node via the default handler.

### Changes Required

#### 1. Switch signal handler from `once` to `on`, with re-entry escalation

**File**: `dev-harness/packages/dev-cli/src/main.ts`
**Changes**: replace `waitForRuntime` (lines 582-598) with a version that lets the second SIGINT/SIGTERM trigger an immediate group-SIGKILL via `runtime.stop`.

```ts
async function waitForRuntime(
  runtime: DevProxyProcessRuntime,
  onStop?: () => void,
): Promise<void> {
  let pressed = false;
  let onStopCalled = false;
  const callOnStop = () => {
    if (onStopCalled) return;
    onStopCalled = true;
    onStop?.();
  };
  const shutdown = (signal: NodeJS.Signals) => {
    callOnStop();
    runtime.stop(signal); // Phase 1: second call escalates to SIGKILL.
    if (pressed) {
      console.error(`\n[lightfast-dev] received ${signal} twice — force killing.`);
    }
    pressed = true;
  };
  for (const signal of SIGNALS) {
    process.on(signal, () => shutdown(signal));
  }
  const result = await runtime.exit;
  callOnStop();
  process.exit(result.exitCode);
}
```

The idempotent `callOnStop` gate fixes a pre-existing bug: the previous implementation called `onStop?.()` once on signal *and* again unconditionally after `await runtime.exit`, so `() => syncRuntime.stop()` (the only caller-supplied `onStop`) ran twice on every signal-triggered shutdown. The new code calls it exactly once in both the signal path and the natural-exit path.

### Success Criteria

#### Automated Verification

- [x] Type checks pass: `pnpm -F @lightfastai/dev-cli typecheck`
- [x] Existing tests pass: `pnpm -F @lightfastai/dev-cli test`
- [x] Build succeeds: `pnpm -F @lightfastai/dev-cli build`

#### Human Review

- [ ] Read the new `waitForRuntime` and confirm a single Ctrl+C invokes `runtime.stop` once; a second Ctrl+C re-enters and calls `runtime.stop` again (which Phase 1 maps to SIGKILL). — TODO: automate via the Phase 3 double-signal test.

---

## Phase 3: dev-harness tests

### Overview

Add focused vitest tests in `dev-harness` that pin the new shutdown contract. Three scenarios capture the regressions this plan fixes.

### Changes Required

#### 1. Test scaffolding helpers

**File**: `dev-harness/packages/dev-proxy/test/runtime-shutdown.test.ts` (new)
**Changes**: create the file with helpers and the three test cases below.

Helpers spawn real Node subprocesses (no mocks) so the tests exercise actual signal/group semantics:

```ts
import { spawn, type ChildProcess } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import {
  createLinkedRuntime,
  createSingleChildRuntime,
  killProcessGroup,
} from "../src/runtime-internal.js"; // see Phase 1 §6

const longLived = (extraGrandchildren = 0) =>
  spawn(
    process.execPath,
    ["-e", `for (let i = 0; i < ${extraGrandchildren}; i++) require("child_process").spawn(process.execPath, ["-e", "setInterval(()=>{}, 1<<30)"]); setInterval(()=>{}, 1<<30);`],
    { detached: process.platform !== "win32", stdio: "ignore" },
  );
const shortLived = () =>
  spawn(process.execPath, ["-e", "setTimeout(()=>process.exit(0), 50)"], {
    detached: process.platform !== "win32",
    stdio: "ignore",
  });

const pidAlive = (pid: number) => {
  try { process.kill(pid, 0); return true; } catch { return false; }
};
```

#### 2. Test — aux exit must not race main child

**File**: same
**Changes**: assert that `runtime.exit` does not resolve when only the auxiliary has exited.

```ts
it("waits for the main child even when an auxiliary exits first", async () => {
  const main = longLived();
  const aux = shortLived();
  const runtime = createLinkedRuntime(main, [aux]);
  // Aux exits in ~50ms; main is still alive.
  await new Promise((resolve) => setTimeout(resolve, 200));
  // runtime.exit must still be pending because main is alive.
  let settled = false;
  runtime.exit.then(() => { settled = true; });
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(settled).toBe(false);
  expect(pidAlive(main.pid!)).toBe(true);
  runtime.stop("SIGTERM");
  await runtime.exit;
  expect(pidAlive(main.pid!)).toBe(false);
});
```

#### 3. Test — group SIGTERM cleans up grandchildren

**File**: same
**Changes**: spawn a child with two grandchildren, signal once, assert all three PIDs are dead.

```ts
it("kills the entire process group on stop()", async () => {
  const main = longLived(2);
  const runtime = createSingleChildRuntime(main);
  // Wait for the child to actually fork its grandchildren.
  await new Promise((resolve) => setTimeout(resolve, 200));
  runtime.stop("SIGTERM");
  await runtime.exit;
  expect(pidAlive(main.pid!)).toBe(false);
  // Group is gone — process.kill(-pgid, 0) should ESRCH.
  expect(() => process.kill(-main.pid!, 0)).toThrow(/ESRCH/);
}, 10_000);
```

#### 4. Test — double stop() escalates to SIGKILL within grace

**File**: same
**Changes**: a "stubborn" child that ignores SIGTERM must still die within the grace window if stop is called twice. With Phase 1 §4's update, this contract holds for *both* runtime constructors — we exercise both to pin the symmetry.

```ts
it("escalates to SIGKILL when stop() is called a second time (linked runtime)", async () => {
  const stubborn = spawn(
    process.execPath,
    ["-e", "process.on('SIGTERM', ()=>{}); setInterval(()=>{}, 1<<30);"],
    { detached: process.platform !== "win32", stdio: "ignore" },
  );
  const aux = shortLived();
  const runtime = createLinkedRuntime(stubborn, [aux]);
  runtime.stop("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(pidAlive(stubborn.pid!)).toBe(true); // ignored SIGTERM
  runtime.stop("SIGTERM"); // second call → SIGKILL via beginShutdown
  await runtime.exit;
  expect(pidAlive(stubborn.pid!)).toBe(false);
}, 10_000);

it("escalates to SIGKILL after the grace window (single-child runtime)", async () => {
  const stubborn = spawn(
    process.execPath,
    ["-e", "process.on('SIGTERM', ()=>{}); setInterval(()=>{}, 1<<30);"],
    { detached: process.platform !== "win32", stdio: "ignore" },
  );
  const runtime = createSingleChildRuntime(stubborn);
  runtime.stop("SIGTERM");
  // SIGTERM ignored; wait past SHUTDOWN_GRACE_MS for the timer-driven SIGKILL.
  await runtime.exit;
  expect(pidAlive(stubborn.pid!)).toBe(false);
}, 10_000);
```

### Success Criteria

#### Automated Verification

- [x] All four new tests pass (split test #4 into linked + single-child variants per the §4 plan note).
- [x] No regressions in existing dev-proxy or dev-cli suites: 58 dev-proxy + 4 dev-cli, all green on darwin.
- [ ] Tests pass on linux (CI macOS runner if available).

#### Human Review

(omit — tests speak for themselves; failures here block the phase.)

---

## Phase 4: Release dev-cli + dev-proxy patch; bump catalog in lightfast repo

### Overview

Cut a patch release of `@lightfastai/dev-cli` and `@lightfastai/dev-proxy` (both ship together; their `0.4.0` versions move to `0.4.1`). Bump the catalog entries in `lightfast/pnpm-workspace.yaml`, run install, and verify the new binaries are wired.

### Changes Required

#### 1. Changesets in dev-harness

**File**: `dev-harness/.changeset/<slug>.md` (new, generated by `pnpm changeset`)
**Changes**: a patch-level changeset covering both packages with a single user-facing line:

```md
---
"@lightfastai/dev-cli": patch
"@lightfastai/dev-proxy": patch
---

Reliably terminate the entire dev process tree on Ctrl+C (use detached process groups, await main child exit, escalate to SIGKILL on second signal).
```

Then `pnpm changeset version && pnpm changeset publish` via the repo's standard release flow.

#### 2. Bump catalog in lightfast repo

**File**: `lightfast/pnpm-workspace.yaml`
**Changes**: update both lines:

```yaml
  '@lightfastai/dev-cli': ^0.4.1
  '@lightfastai/dev-proxy': ^0.4.1
```

Then `pnpm install` at the lightfast repo root. Verify `node_modules/@lightfastai/dev-cli/package.json` and `node_modules/@lightfastai/dev-proxy/package.json` report the new version.

### Success Criteria

#### Automated Verification

- [x] `pnpm install` completes cleanly at the lightfast repo root.
- [x] `node -e "console.log(require('@lightfastai/dev-proxy/package.json').version)"` prints `0.4.1`.
- [x] `pnpm typecheck` passes (37/37). `pnpm check` errors on pre-existing unrelated lint in `.agents/skills/lightfast-desktop-signin/lib/write-auth-bin.mjs`; not introduced by this bump.

#### Human Review

- [x] Published 0.4.1 verified on npm via the workflow's cross-version-alignment check (`@lightfastai/dev-cli/dev-core/dev-proxy/dev-services` all 0.4.1, with provenance).

---

## Phase 5: Trim scripts/dev-services.mjs in lightfast repo

### Overview

`scripts/dev-services.mjs` currently has its own SIGINT/SIGTERM handler that forwards to its child and a `child.on('exit')` that calls `process.exit(...)` immediately. With Phase 1 + 2, the child (`lightfast-dev`) drains the full tree before exiting, so this layer is mostly redundant. The signal forwarding is still useful (so a SIGTERM to dev-services from outside, e.g. `kill <pid>`, reaches lightfast-dev), but it should not pre-empt the child's drain.

### Changes Required

#### 1. Forward signals via process group, drop redundant exit short-circuit

**File**: `lightfast/scripts/dev-services.mjs`
**Changes**: replace lines 315-339 of `handleInngestSync`:

```js
const child = spawn(commandArgs[0], commandArgs.slice(1), {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
  detached: process.platform !== "win32",
});

let shuttingDown = false;
const shutdown = (signal) => {
  if (shuttingDown) {
    // second signal: hand off to default handler so the user can force-kill if even our drain is wedged
    process.kill(process.pid, signal);
    return;
  }
  shuttingDown = true;
  syncRuntime.stop();
  if (child.pid && !child.killed) {
    try {
      process.kill(-child.pid, signal);
    } catch {
      child.kill(signal);
    }
  }
};

for (const signal of signals) {
  process.on(signal, () => shutdown(signal));
}

child.on("exit", (code, signal) => {
  if (!shuttingDown) {
    syncRuntime.stop();
  }
  process.exit(signal ? signalExitCode(signal) : (code ?? 0));
});
```

The key changes vs. the existing code: `detached: true` so we can kill the child's group, `process.on` instead of `process.once` so a re-entered signal hits the default handler, and `process.kill(-child.pid, signal)` for group propagation.

`signals` (line 15) and `signalExitCode` (line 496) are already defined in this file and are unchanged.

### Success Criteria

#### Automated Verification

- [x] `pnpm typecheck` passes (37/37, full turbo cache hit). `pnpm check` errors on the same pre-existing unrelated lint in `.agents/skills/lightfast-desktop-signin/lib/write-auth-bin.mjs` flagged in Phase 4; not introduced by this change.
- [x] `node scripts/dev-services.mjs --help` still prints usage (no startup regression).

#### Human Review

- [~] **Single Ctrl+C, normal state.** Tested 4× via agent harness on 2026-05-11. **3/4 trials leak the same orphan**: `lightfast-dev proxy app-runtime -- next dev --turbopack` for www, holding `:4481`. The lucky pass was a race-window outlier; steady-state failure rate is ~100% for the www app. app + platform (which use `--turbo`, not `--turbopack`) drain cleanly in every trial. The `app-runtime` spawn is detached per Phase 1 §2 (`runtime.ts:435`), so when its parent `proxy app` dies it becomes its own pgrp leader with no upstream signaller — and `next-server`'s Turbopack worker keeps `:4481` bound.
- [x] **Double Ctrl+C escalation timing.** Verified: outer drain in 108ms (well under 500ms target). Phase 1+2 escalation path fires correctly. **But** the same www `app-runtime` orphan survives — fast SIGKILL gives no time to walk the detached app-runtime pgrps.
- [x] **`dev:app` variant single SIGINT.** Clean drain in 6s, no orphans, no bound ports, no escalation needed (no "force killing" log). Single-app tree (no turbo + no microfrontends + no portless route stub) avoids the failure mode entirely.
- [~] **Ctrl+C during recompile.** Same orphan as Single Ctrl+C — note the touch-trigger in this trial didn't actually start a recompile within the 500ms window, so this is effectively a second single-SIGINT trial with the same outcome. A real mid-recompile test still pending.
- [x] **Port reclaim (Portless daemon retained).** `:443` daemon persists across all trials. Other dev ports (`:3119`, `:7493`, `:9355`) reliably free; `:4481` (www) leaks when the app-runtime orphan above survives.

**Diagnosis — Phase 1 §2 over-detached.** `dev-proxy/src/runtime.ts:435` is the inner `app-runtime` spawn, called by each `lightfast-dev proxy app` (one per next.js app). Phase 1 made it `detached: true`, which makes it a process-group leader. Its parent `proxy app` is itself a child of the turbo tree — when turbo dies (whether via SIGTERM grace or SIGKILL escalation), `proxy app` dies with it, but `app-runtime` (now its own pgrp) and the `next dev` it spawned are reparented to PID 1 with no signaller upstream. The PROXY-level runtime constructors only know about the *turbo* + auxiliary groups they directly spawned — they have no list of grandchildren `app-runtime` groups to forward signals to.

**Failure is www-specific in practice but not by design.** All three apps spawn `proxy app-runtime`; www happens to lose every race, app/platform happen to drain in time. Fix needs to either (a) **not detach `app-runtime`** (keep it in the parent `proxy app` pgrp so the cascading signal naturally reaches it), or (b) track grandchild pgrps in the runtime and signal them on shutdown. (a) is simpler — `app-runtime` doesn't need its own pgrp because it's the leaf wrapper around `next dev`; cascading TTY/signal semantics should work without it.

**Status: Phase 5 of this plan is correctly implemented and works in isolation. The remaining bug lives upstream in `dev-harness/packages/dev-proxy/src/runtime.ts` and requires a follow-up patch release.**

### 2026-05-11 — Option A landed in dev-harness (commit `5bc37db` on `main`)

`packages/dev-proxy/src/runtime.ts`: dropped `detached: true` on the inner `proxy app → proxy app-runtime` spawnWithFallback call site (now passes `detached: false` explicitly to override `spawnWithFallback`'s default) and on the `proxy app-runtime → next dev` direct spawn in `startDevProxyAppRuntimeCommand`. Outer `turbo` / `microfrontends proxy` / `portless route` spawns kept detached so the top-level `createLinkedRuntime` can still group-kill them. Changeset added (`.changeset/app-runtime-pgrp-cascade.md`); 58/58 dev-proxy tests green; pushed to dev-harness `main`. Once the changesets-bot Version Packages PR merges, `@lightfastai/dev-proxy` ships as `0.4.2`.

**In-repo validation against the hot-patched dist (4 trials):**

- 3× single SIGINT against `pnpm dev` → 0 orphans, 0 bound dev ports in every trial (was: 3/3 leaked the www `app-runtime → next-server` on `:4481`).
- 1× double SIGINT against `pnpm dev` → outer drain in 162ms, 0 orphans, 0 bound dev ports (was: same orphan despite 108ms drain time).

**Follow-ups needed in this repo (blocked on 0.4.2 publish):**

- [x] Bump `pnpm-workspace.yaml` catalog: all four `@lightfastai/dev-{cli,core,proxy,services}` from `^0.4.0` → `^0.4.2` (the changesets release bumped them as a unit). Done 2026-05-11 after PR #5 merged.
- [x] `pnpm install` — landed published 0.4.2 dist; replaced the hot-patched 0.4.1 install. Verified `node -e "require('@lightfastai/dev-proxy/package.json').version"` reports `0.4.2`, and the dist's `runtime.js` carries `detached: false` at the two inner spawn sites (lines 295 + 318 of compiled output).
- [x] Re-verified scenarios on published 0.4.2: 3/3 single-SIGINT trials clean (0 orphans, 0 bound dev ports); 1/1 double-SIGINT trial drained in 100ms with 0 orphans. Hot-patch and shipped dist behave identically.

---

## Testing Strategy

### Unit (vitest, in dev-harness)
Phase 3 adds three runtime tests:
- Aux exits first → `runtime.exit` blocks until main child exits.
- `stop("SIGTERM")` kills the full process group (grandchildren too).
- Second `stop()` call escalates to SIGKILL within the grace window.

### Integration (manual, listed in Phase 5 Human Review)
The four scenarios above (single Ctrl+C, Ctrl+C during recompile, double Ctrl+C, `dev:app`).

### Future automation
The Phase 5 Human Review items each carry a `— TODO: automate via …` suffix. A follow-up CI job can spawn `pnpm dev` in a pty, wait for the "compiled successfully" markers in stdout, send SIGINT, then assert no orphan PIDs match a list of name patterns. Out of scope for this plan; tracked as a graduation target.

## Performance Considerations

- The 3-second grace window adds at most 3s to shutdown for stuck children. In the happy path (graceful SIGTERM works), shutdown completes when the last child exits — typically <1s.
- `detached: true` has no runtime overhead beyond the `setsid()` call at spawn time.
- The new `Promise.race` in `createLinkedRuntime` and the `setTimeout` escalation use `.unref()` so they don't keep the parent event loop alive past the natural exit.

## Migration Notes

- The dev-cli/dev-proxy changes are backwards-compatible at the public API level (`startDevProxyTurboCommand`, `waitForRuntime`, etc. keep the same signatures). The behavioral change is "shutdown waits longer and is more thorough" — no consumer should need to update call sites.
- The `scripts/dev-services.mjs` change in Phase 5 changes the spawning shape (`detached: true`). Anything that wraps `node scripts/dev-services.mjs ...` externally (CI, devcontainer scripts) keeps working because Node still has the controlling terminal and stdio is inherited.
- Windows note: the POSIX-only path is gated on `process.platform !== "win32"`; the win32 branch keeps the existing `child.kill(signal)` behavior. We do not ship a Windows fix here.

## References

- Bug report: user-reported Ctrl+C orphans during `pnpm dev`; documented workaround in `CLAUDE.md:88,124`.
- Existing process tree origin: `lightfast/package.json:17` (`dev` script).
- Root-cause sites:
  - `dev-harness/packages/dev-proxy/src/runtime.ts:812-874` (`createLinkedRuntime` early-resolve race).
  - `dev-harness/packages/dev-cli/src/main.ts:582-598` (`waitForRuntime` no escalation, no drain).
  - `lightfast/scripts/dev-services.mjs:315-339` (parent `process.exit` short-circuit).
- Adjacent: Portless `spawnCommand` detached behavior in `portless/dist/cli.js:1660` (informs why the route-stub stays in its own pgrp).

## Improvement Log

### 2026-05-11 — adversarial review (via `/improve_plan`)

Research agents (codebase-analyzer × 2, thoughts-locator, codebase-pattern-finder) verified the plan's diagnosis against the live `dev-harness` and `lightfast` repos. Findings led to four substantive corrections plus a sequencing note.

**Changes applied:**

1. **Phase 1 §2 — spawn-site line numbers corrected.** Plan claimed sites at 172, 213, 279, 397, 435, 758. Verified actual direct `spawn` calls: 172, 279, 435, and 765 (inside `spawnWithFallback`). Lines 213 and 397 are `spawnWithFallback` *callers*, not bare `spawn` sites; the option flows through the spread at line 765. Noted explicitly to avoid implementer confusion.

2. **Phase 1 §4 — `createSingleChildRuntime` now mirrors the escalation contract** (was: only routed `stop()` through `killProcessGroup`). Without this, `startDevProxyRuntime` and `startDevProxyAppCommand` consumers would have no SIGKILL path for stubborn children, creating an inconsistent shutdown contract. *User chose: "Mirror the escalation"* — added grace timer + idempotent second-call SIGKILL symmetric to `createLinkedRuntime`.

3. **Phase 1 §5 — variable names corrected.** Plan referred to `proc.kill("SIGTERM")` but actual `runtime.ts:158-165` uses `proxy.kill` and `route.kill` (two distinct local variables).

4. **Phase 1 §6 — new step: `runtime-internal.ts` test entry.** `createLinkedRuntime`, `createSingleChildRuntime`, and the new `killProcessGroup` are unexported `function` declarations (`runtime.ts:786, 812`); Phase 3's tests as originally written would fail to compile with "Module has no exported member". *User chose: "Export via internal entry (Recommended)"* — added an explicit re-export file rather than enlarging the package's public surface.

5. **Phase 1 §7 — behavioral note flagged.** The `createLinkedRuntime` rewrite changes `runtime.exit`'s exit code when an auxiliary crashes mid-run (was: aux's code; now: main child's code). Documented in the plan and noted for the changeset.

6. **Phase 2 §1 — `onStop` double-call fixed.** Pre-existing bug: `waitForRuntime` invoked `onStop?.()` once in the signal path and again unconditionally after `runtime.exit`, calling `syncRuntime.stop()` twice on every signal-triggered shutdown. *User chose: "Fix it"* — added an idempotent `callOnStop` gate.

7. **Phase 3 §1 + §4 — broken tests rewritten.** Test imports retargeted to `../src/runtime-internal.js`. Test #4 (escalation) split into two assertions covering both `createLinkedRuntime` and `createSingleChildRuntime` (was: a hand-wavy half-test against `createSingleChildRuntime` with an in-code TODO note).

8. **New "Sequencing" section.** Documents that Phase 5 is independently verifiable in this repo, separable from the dev-harness release cycle. Recommends landing Phase 5 first and confirming orphan elimination before committing to the dev-harness release coordination in Phase 4.

**Spike (REFUTED on 2026-05-11):** *User chose: "Yes, spike it"* — two spike attempts.

- **Attempt 1** (isolated worktree, since cleaned up): syntax-validated the Phase 5 §1 diff (+17/-2 LOC) but couldn't run the live test because the primary worktree already had a live (orphaned) dev stack.
- **Attempt 2** (in-place, with user confirmation): killed the pre-existing orphan stack, applied Phase 5 §1 directly to `scripts/dev-services.mjs`, ran `pnpm dev`, observed all three apps reach "✓ Ready", inspected the process tree, and then reverted.

The result was **decisive against Phase-5-only**: even with the wrapper fix in place, the outer `lightfast-dev` parent exited *before* the user could press Ctrl+C, leaving turbo (PID 45120) + microfrontends proxy (PID 45093) and their subtrees orphaned to PPID 1. The pre-existing orphan turbo PID 94653 (from a prior session) was the same failure mode confirming this is reproducible. The `createLinkedRuntime` aux-exit race fires during normal startup/compile, not just on shutdown — so Phase 5's group-kill has nothing alive to forward signals through.

Sequencing in the plan was inverted to reflect this: Phases 1–4 are now mandatory predecessors to Phase 5, not optional companion work. `scripts/dev-services.mjs` was reverted to its pre-spike state (verified via `git diff`).
