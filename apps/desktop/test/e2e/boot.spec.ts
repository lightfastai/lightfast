import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { _electron, expect, type Page, test } from "@playwright/test";

// `apps/desktop/package.json` has no `"type": "module"`, so Playwright's TS
// loader compiles this spec as CJS. Use __dirname — both `import.meta.url`
// and `import.meta.dirname` throw under CJS. (Verified via spike 2026-05-06
// and re-verified when biome's auto-fix to `import.meta.dirname` broke the
// spec.)
// biome-ignore lint/correctness/noGlobalDirnameFilename: spec runs as CJS, see comment above.
const desktopRoot = resolve(__dirname, "..", "..");
const repoRoot = resolve(desktopRoot, "..", "..");

// The desktop package dev script wraps Electron in scripts/with-desktop-env.mjs,
// which derives LIGHTFAST_APP_ORIGIN from the workspace's Portless config. The
// unpackaged main process treats that var as required (apps/desktop/src/main/
// app-origin.ts); without it the app aborts before the primary window opens.
// Mirror the wrapper's `--print` output here so the spec works both locally
// and on CI without re-implementing URL resolution.
function loadDesktopEnv(): Record<string, string> {
  const out = execFileSync(
    "node",
    [resolve(repoRoot, "scripts/with-desktop-env.mjs"), "--print"],
    { encoding: "utf8" }
  );
  const env: Record<string, string> = {};
  for (const line of out.split("\n")) {
    const m = /^(\w+)=(.*)$/.exec(line);
    if (m && m[1] !== undefined && m[2] !== undefined) {
      env[m[1]] = m[2];
    }
  }
  return env;
}

function stringEnv(source: NodeJS.ProcessEnv): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(source)) {
    if (typeof v === "string") {
      out[k] = v;
    }
  }
  return out;
}

test("boots, renderer paints, quits cleanly", async () => {
  const errors: string[] = [];

  const electronApp = await _electron.launch({
    args: ["."],
    cwd: desktopRoot,
    env: { ...stringEnv(process.env), ...loadDesktopEnv() },
  });

  // src/main/index.ts:259-261 auto-opens detached devtools when
  // !app.isPackaged. `firstWindow()` races and can return the devtools
  // BrowserWindow (URL `devtools://...`) — its body is non-empty too, which
  // masks renderer failures. Drain `windows()` for any already-open
  // non-devtools page first, then fall back to `waitForEvent("window")`
  // for windows that open after launch resolves.
  let window: Page | undefined = electronApp
    .windows()
    .find((w) => !w.url().startsWith("devtools://"));
  if (!window) {
    window = await electronApp.waitForEvent("window", {
      predicate: (w) => !w.url().startsWith("devtools://"),
      timeout: 30_000,
    });
  }

  // Track only pageerror (uncaught exceptions in renderer code) — that is the
  // smoke we care about. We deliberately do NOT track console.error: in
  // offline CI without an API mesh the tRPC client logs `account.get`
  // ERR_CONNECTION_REFUSED on mount, which is environmental, not a renderer
  // bug. pageerror catches truly broken renderer states (failed imports,
  // throwing components, hydration errors).
  window.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));

  // Anchor on the React mount point, not just `body :not-empty` — chrome-error
  // and devtools pages also have non-empty bodies. `#react-root` is the
  // primary window's mount id (apps/desktop/src/renderer/index.html:118 +
  // src/renderer/src/react/entry.tsx:34). Use `state: "attached"` because the
  // first child is sonner's `<section aria-live="polite">` (always present,
  // never visible). Attachment proves the React tree mounted, which is the
  // smoke we care about.
  await window.waitForSelector("#react-root *", {
    state: "attached",
    timeout: 30_000,
  });

  await electronApp.close();

  expect(errors, errors.join("\n")).toEqual([]);
});
