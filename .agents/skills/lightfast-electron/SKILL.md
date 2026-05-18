---
name: lightfast-electron
description: |
  Start, verify, and stop the Lightfast desktop Electron app from an agent
  harness. Triggers when the user asks to start, launch, run, or boot the
  desktop app, or when another skill (e.g. lightfast-desktop-signin) requires
  the app to be running. Works around an upstream electron-forge bug where
  `electron-forge start` exits ~7 ms after "Launched Electron app" when stdin
  is non-TTY (the default for agent-spawned shells, CI, nohup, and
  child_process.spawn). Humans on a real TTY should use `pnpm dev:desktop`
  directly.
---

# Lightfast Electron Skill

Agent-only runbook for getting the Electron desktop dev server (Electron +
Vite on `:5173`) up, verified, and torn down. The existing `pnpm dev:desktop`
script works fine from a TTY but exits within milliseconds when an agent
spawns it, because forge's CLI hardcodes `interactive: true` and calls
`process.stdin.resume()`. This skill encodes the verified workaround.

## When to use

You need the desktop dev server running. This includes: driving sign-in
via `lightfast-desktop-signin`, smoke-testing renderer surfaces, exercising
tRPC procedures from the desktop, or any end-to-end flow that requires a
live Electron window.

Humans on a real TTY: use `pnpm dev:desktop` directly. The interactive
`rs` restart keystroke still works there. The pipe trick below is purely
an agent workaround.

## Why this skill exists

`@electron-forge/cli@7.11.1` (latest as of 2026-04-26) hardcodes
`interactive: true` in `electron-forge-start.ts`, which calls
`process.stdin.resume()` and exits the moment stdin EOFs — the default
for non-TTY contexts. The `@electron-forge/plugin-vite` `process.on('exit')`
handler then tears down the spawned Electron child. Net effect: forge
dies in ~7 ms when an agent spawns it.

Verified upstream — same bug class fixed in
[vitejs/vite#11262](https://github.com/vitejs/vite) and
[slidevjs/slidev#2497](https://github.com/slidevjs/slidev/issues/2497)
with a `process.stdin.isTTY` guard. electron-forge's own `init` CLI
already uses this guard; only `start` was missed. No CLI flag, env var,
or newer version exists today.

## Start

```bash
tail -f /dev/null | pnpm dev:desktop > /tmp/lightfast-desktop.log 2>&1 &
```

The `tail -f /dev/null` keeps a non-EOF source piped into forge's stdin,
which prevents the `process.stdin.resume()` exit path. The pipe lives
inside the npm-script subshell, so the parent agent shell can background
it normally with `&` without disturbing the pipe.

## Verify it's up (give it ~10 s)

```bash
sleep 10
pgrep -f 'Electron\.app/Contents/MacOS/Electron' | head -1   # should print a PID
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5173/   # should print 200
```

If either fails, tail the log: `tail -50 /tmp/lightfast-desktop.log`.

## Stop

```bash
pkill -f 'Electron\.app/Contents/MacOS/Electron'
pkill -f electron-forge
pkill -f 'tail -f /dev/null'   # only if you started one — be aware this
                                # matches any tail -f /dev/null on the box
```

## If a stale Singleton lock blocks startup

```bash
rm -f ~/Library/Application\ Support/Lightfast\ Dev/Singleton*
```

This happens when a previous Electron process was SIGKILLed. Chromium's
own logic usually clears stale-PID locks on next launch, but if the next
launch fails immediately, clearing manually is safe.

## Boundaries

- macOS only. Linux works the same; Windows desktop dev is out of scope.
- This is a workaround. The right fix is upstream: `electron-forge`
  should guard `process.stdin.resume()` with `process.stdin.isTTY`,
  matching the pattern already used in its own `init` CLI and in
  Slidev/Vite. Filing the upstream issue is tracked separately.
- This skill does not start the API mesh (`pnpm dev:app`,
  `pnpm dev:platform`). If your flow requires those, start them first;
  the desktop app expects `:3024` to be reachable.
