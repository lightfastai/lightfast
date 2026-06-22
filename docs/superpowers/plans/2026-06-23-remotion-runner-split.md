# Remotion Runner Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the current Remotion package into an `apps/remotion` runner and a reusable `packages/remotion` composition package.

**Architecture:** `@repo/remotion` owns reusable composition source, the manifest, the Remotion root component, CSS, and the webpack CSS override. `@lightfast/remotion` owns Remotion CLI scripts, `registerRoot`, render/watch scripts, Studio config, cache/output folders, and output distribution. Root helper scripts call the app runner, while compositions continue to consume brand primitives from `@repo/ui-v2`.

**Tech Stack:** pnpm 11, Turborepo, TypeScript, React 19, Remotion 4, Tailwind 4, `@vendor/remotion`.

---

## Scope

This plan implements the runner/package split only. The Paper MCP stills
`brilliant-mist-logo-square-clearspace-dark` and
`brand-partnership-clearspace-dark` should be planned after this split lands,
because those compositions require inspecting the Paper MCP design nodes for
exact dimensions, colors, and spacing.

## File Structure

- Move tracked source from `packages/app-remotion/**` to
  `packages/remotion/**`.
- Create `apps/remotion/package.json`: private app runner named
  `@lightfast/remotion`.
- Create `apps/remotion/tsconfig.json`: app TypeScript config.
- Create `apps/remotion/turbo.json`: app Turborepo metadata.
- Move `packages/remotion/remotion.config.ts` to
  `apps/remotion/remotion.config.ts`.
- Move `packages/remotion/postcss.config.mjs` to
  `apps/remotion/postcss.config.mjs`.
- Move `packages/remotion/src/render.ts` to `apps/remotion/src/render.ts`.
- Move `packages/remotion/src/watch.ts` to `apps/remotion/src/watch.ts`.
- Create `apps/remotion/src/index.ts`: imports package CSS, registers the
  package root with Remotion.
- Modify `packages/remotion/package.json`: private reusable package named
  `@repo/remotion`, no runner scripts.
- Modify `packages/remotion/src/index.ts`: export reusable package API instead
  of calling `registerRoot`.
- Keep `packages/remotion/src/Root.tsx`: maps manifest entries to Remotion
  `Composition` and `Still` nodes.
- Keep `packages/remotion/src/manifest.ts`: single source of truth for
  composition metadata and output targets.
- Keep `packages/remotion/src/webpack-override.ts`: shared CSS loader override
  used by the app runner.
- Modify `packages/remotion/src/styles.css`: Tailwind sources remain relative to
  the reusable package.
- Modify root `package.json`: point Remotion helper scripts at
  `@lightfast/remotion`.
- Modify `knip.json`: add an `apps/remotion` workspace entry and remove the old
  `packages/app-remotion` ignored workspace.
- Update `pnpm-lock.yaml` by running pnpm after package names change.

## Task 1: Rename The Existing Package

**Files:**
- Move: `packages/app-remotion` -> `packages/remotion`
- Modify: `packages/remotion/package.json`
- Modify: `packages/remotion/src/manifest.ts`
- Modify: `package.json`
- Modify: `knip.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Confirm the starting worktree**

Run:

```bash
git status --short
```

Expected: unrelated existing user edits may be present, but no uncommitted
changes inside `packages/app-remotion`, root `package.json`, `knip.json`, or
`pnpm-lock.yaml`. If one of those files already has user edits, inspect it and
preserve the user changes while applying this task.

- [ ] **Step 2: Move the tracked package files**

Run:

```bash
git mv packages/app-remotion packages/remotion
```

Expected: tracked files move to `packages/remotion`. Ignored generated folders
such as `packages/app-remotion/node_modules`, `packages/app-remotion/.cache`,
and `packages/app-remotion/out` may remain on disk; do not stage them.

- [ ] **Step 3: Rename the package while keeping runner scripts temporarily**

Replace `packages/remotion/package.json` with:

```json
{
  "name": "@repo/remotion",
  "license": "Apache-2.0",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "scripts": {
    "clean": "git clean -xdf .cache .turbo node_modules",
    "dev": "npx tsx src/watch.ts",
    "typecheck": "tsc --noEmit",
    "studio": "npx remotion studio src/index.ts",
    "render:all": "npx tsx src/render.ts",
    "render:video": "npx tsx src/render.ts --only video",
    "render:stills": "npx tsx src/render.ts --only stills"
  },
  "dependencies": {
    "@vendor/remotion": "workspace:*",
    "clsx": "catalog:",
    "react": "catalog:react19",
    "react-dom": "catalog:react19",
    "tailwind-merge": "catalog:"
  },
  "devDependencies": {
    "@remotion/cli": "^4.0.448",
    "@repo/typescript-config": "workspace:*",
    "@repo/ui": "workspace:*",
    "@repo/ui-v2": "workspace:*",
    "@tailwindcss/postcss": "catalog:tailwind4",
    "@types/node": "catalog:",
    "@types/react": "catalog:react19",
    "@types/react-dom": "catalog:react19",
    "css-loader": "^7.1.4",
    "postcss": "catalog:tailwind4",
    "postcss-loader": "^8.1.1",
    "style-loader": "^4.0.0",
    "tailwindcss": "catalog:tailwind4",
    "tsx": "^4.21.0",
    "typescript": "catalog:"
  }
}
```

Expected: this task is an intermediate state. The package is renamed but still
contains runner scripts until Task 2 creates `apps/remotion`.

- [ ] **Step 4: Move local generated output targets to the renamed package**

Run:

```bash
perl -0pi -e 's#packages/app-remotion/out#packages/remotion/out#g' packages/remotion/src/manifest.ts
```

Then run:

```bash
rg -n "packages/app-remotion/out" packages/remotion/src/manifest.ts
```

Expected: `rg` exits with no matches.

- [ ] **Step 5: Point root scripts at the renamed package temporarily**

In root `package.json`, change only the Remotion scripts to:

```json
"remotion:studio": "pnpm --filter @repo/remotion studio",
"remotion:render": "pnpm --filter @repo/remotion render:all"
```

Expected: root helper scripts still work before the app runner exists.

- [ ] **Step 6: Update the temporary Knip ignore**

In `knip.json`, change:

```json
"ignoreWorkspaces": ["packages/app-remotion"],
```

to:

```json
"ignoreWorkspaces": ["packages/remotion"],
```

Expected: Knip no longer references the old package path.

- [ ] **Step 7: Refresh the lockfile**

Run:

```bash
pnpm install --lockfile-only
```

Expected: `pnpm-lock.yaml` changes the workspace importer from
`packages/app-remotion` to `packages/remotion` and the importer package name to
`@repo/remotion`.

- [ ] **Step 8: Typecheck the renamed package**

Run:

```bash
pnpm --filter @repo/remotion typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit the rename**

Run:

```bash
git status --short
git add package.json knip.json pnpm-lock.yaml packages/remotion
git add -u packages/app-remotion
git commit -m "refactor(remotion): rename reusable package"
```

Expected: commit succeeds. Do not stage ignored generated output, cache, or
`node_modules` folders.

## Task 2: Create The App Runner

**Files:**
- Create: `apps/remotion/package.json`
- Create: `apps/remotion/tsconfig.json`
- Create: `apps/remotion/turbo.json`
- Create: `apps/remotion/src/index.ts`
- Move: `packages/remotion/remotion.config.ts` ->
  `apps/remotion/remotion.config.ts`
- Move: `packages/remotion/postcss.config.mjs` ->
  `apps/remotion/postcss.config.mjs`
- Move: `packages/remotion/src/render.ts` -> `apps/remotion/src/render.ts`
- Move: `packages/remotion/src/watch.ts` -> `apps/remotion/src/watch.ts`
- Modify: `packages/remotion/package.json`
- Modify: `packages/remotion/src/index.ts`
- Modify: `packages/remotion/src/manifest.ts`
- Modify: `package.json`
- Modify: `knip.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Move runner-only files into `apps/remotion`**

Run:

```bash
mkdir -p apps/remotion/src
git mv packages/remotion/remotion.config.ts apps/remotion/remotion.config.ts
git mv packages/remotion/postcss.config.mjs apps/remotion/postcss.config.mjs
git mv packages/remotion/src/render.ts apps/remotion/src/render.ts
git mv packages/remotion/src/watch.ts apps/remotion/src/watch.ts
```

Expected: the reusable package no longer owns Remotion CLI config or executable
render/watch scripts.

- [ ] **Step 2: Add the runner package manifest**

Create `apps/remotion/package.json`:

```json
{
  "name": "@lightfast/remotion",
  "version": "0.1.0",
  "private": true,
  "license": "Apache-2.0",
  "type": "module",
  "scripts": {
    "clean": "git clean -xdf .cache .turbo out node_modules",
    "dev": "tsx src/watch.ts",
    "typecheck": "tsc --noEmit",
    "studio": "remotion studio src/index.ts",
    "render:all": "tsx src/render.ts",
    "render:video": "tsx src/render.ts --only video",
    "render:stills": "tsx src/render.ts --only stills"
  },
  "dependencies": {
    "@repo/remotion": "workspace:*",
    "@vendor/remotion": "workspace:*",
    "react": "catalog:react19",
    "react-dom": "catalog:react19"
  },
  "devDependencies": {
    "@remotion/cli": "^4.0.448",
    "@repo/typescript-config": "workspace:*",
    "@tailwindcss/postcss": "catalog:tailwind4",
    "@types/node": "catalog:",
    "@types/react": "catalog:react19",
    "@types/react-dom": "catalog:react19",
    "css-loader": "^7.1.4",
    "postcss": "catalog:tailwind4",
    "postcss-loader": "^8.1.1",
    "style-loader": "^4.0.0",
    "tailwindcss": "catalog:tailwind4",
    "tsx": "^4.21.0",
    "typescript": "catalog:"
  }
}
```

Expected: `@lightfast/remotion` is a private app package and owns executable
tooling dependencies.

- [ ] **Step 3: Add the runner TypeScript config**

Create `apps/remotion/tsconfig.json`:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "lib": ["ES2022", "dom", "dom.iterable"],
    "jsx": "react-jsx",
    "types": ["node"]
  },
  "include": ["src", "remotion.config.ts"],
  "exclude": ["node_modules"]
}
```

Expected: app runner TypeScript covers the Remotion config and executable
scripts.

- [ ] **Step 4: Add the runner Turborepo metadata**

Create `apps/remotion/turbo.json`:

```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "extends": ["//"],
  "tags": ["app"],
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

Expected: the runner is tagged as an app and its watch task is not cached.

- [ ] **Step 5: Add the Remotion app entrypoint**

Create `apps/remotion/src/index.ts`:

```ts
import "@repo/remotion/styles.css";
import { RemotionRoot } from "@repo/remotion";
import { registerRoot } from "@vendor/remotion";

registerRoot(RemotionRoot);
```

Expected: the app runner owns `registerRoot`, while the reusable package owns
the Remotion root component and CSS.

- [ ] **Step 6: Convert the reusable package manifest**

Replace `packages/remotion/package.json` with:

```json
{
  "name": "@repo/remotion",
  "license": "Apache-2.0",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "sideEffects": ["./src/styles.css"],
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    },
    "./styles.css": "./src/styles.css"
  },
  "scripts": {
    "clean": "git clean -xdf .cache .turbo node_modules",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@repo/ui": "workspace:*",
    "@repo/ui-v2": "workspace:*",
    "@vendor/remotion": "workspace:*",
    "clsx": "catalog:",
    "react": "catalog:react19",
    "react-dom": "catalog:react19",
    "tailwind-merge": "catalog:"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@types/node": "catalog:",
    "@types/react": "catalog:react19",
    "@types/react-dom": "catalog:react19",
    "typescript": "catalog:"
  }
}
```

Expected: `@repo/remotion` no longer exposes runner scripts or runner-only
dependencies.

- [ ] **Step 7: Export the reusable Remotion API**

Replace `packages/remotion/src/index.ts` with:

```ts
export { RemotionRoot } from "./Root";
export {
  getStills,
  getVideos,
  MANIFEST,
  type CompositionEntry,
  type CompositionManifest,
} from "./manifest";
export { enableCssLoaders } from "./webpack-override";
```

Expected: app runner files can import the package API from `@repo/remotion`.

- [ ] **Step 8: Keep Tailwind source scanning package-local**

Replace `packages/remotion/src/styles.css` with:

```css
@import "tailwindcss/index.css";
@import "@repo/ui-v2/fonts.css";
@import "@repo/ui-v2/shadcn.css";
@import "@repo/ui-v2/theme.css";

@source "./**/*.{ts,tsx}";
```

Expected: Tailwind scans the reusable package source even though CSS is imported
from the app runner.

- [ ] **Step 9: Point generated local artifacts at the app runner**

Run:

```bash
perl -0pi -e 's#packages/remotion/out#apps/remotion/out#g' packages/remotion/src/manifest.ts
```

Then run:

```bash
rg -n "packages/remotion/out|packages/app-remotion/out" packages/remotion/src/manifest.ts
```

Expected: `rg` exits with no matches. Public asset destinations such as
`apps/app/public` and `apps/www/public` remain unchanged.

- [ ] **Step 10: Update the app Remotion config**

Replace `apps/remotion/remotion.config.ts` with:

```ts
import { Config } from "@remotion/cli/config";
import { enableCssLoaders } from "@repo/remotion";

Config.setEntryPoint("src/index.ts");
Config.setOverwriteOutput(true);
Config.setPublicDir("../../apps/www/public");
Config.overrideWebpackConfig(enableCssLoaders);
```

Expected: Remotion Studio runs from `apps/remotion` and uses the package CSS
loader override.

- [ ] **Step 11: Update the render script imports**

In `apps/remotion/src/render.ts`, replace:

```ts
import { getStills, getVideos, MANIFEST } from "./manifest";
import { enableCssLoaders } from "./webpack-override";
```

with:

```ts
import {
  enableCssLoaders,
  getStills,
  getVideos,
  MANIFEST,
} from "@repo/remotion";
```

Also update the usage comment near the argument parsing to:

```ts
// Usage: tsx src/render.ts [--only stills|video|all] [--id composition-id]
```

Expected: `render.ts` still computes `ROOT` with
`path.resolve(__dirname, "../../..")`, uses `apps/www/public` as the public
directory, and writes temporary render output under `apps/remotion/.cache`.

- [ ] **Step 12: Update the watch script to watch package source**

Replace `apps/remotion/src/watch.ts` with:

```ts
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const compositionsDir = path.resolve(ROOT, "packages/remotion/src");

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let isRendering = false;

function render() {
  if (isRendering) {
    console.log("[remotion] Render already in progress, queuing...");
    scheduleRender();
    return;
  }

  isRendering = true;
  const start = performance.now();
  console.log("[remotion] Rendering video...");

  try {
    execSync("pnpm --filter @lightfast/remotion render:video", {
      cwd: ROOT,
      stdio: "inherit",
    });
    const elapsed = ((performance.now() - start) / 1000).toFixed(1);
    console.log(`[remotion] Video rendered in ${elapsed}s`);
  } catch {
    console.error("[remotion] Render failed");
  } finally {
    isRendering = false;
  }
}

function scheduleRender() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(render, 500);
}

render();

console.log("[remotion] Watching package source for changes...");

const watcher = fs.watch(
  compositionsDir,
  { recursive: true },
  (_event, filename) => {
    if (!filename) {
      return;
    }
    if (!/\.(ts|tsx|css)$/.test(filename)) {
      return;
    }
    console.log(`[remotion] Changed: ${filename}`);
    scheduleRender();
  }
);

process.on("SIGINT", () => {
  watcher.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  watcher.close();
  process.exit(0);
});
```

Expected: the app runner watches `packages/remotion/src` and invokes the app
runner render script.

- [ ] **Step 13: Update root helper scripts to use the app runner**

In root `package.json`, change only the Remotion scripts to:

```json
"remotion:studio": "pnpm --filter @lightfast/remotion studio",
"remotion:render": "pnpm --filter @lightfast/remotion render:all"
```

Expected: root helper scripts now target `apps/remotion`.

- [ ] **Step 14: Add Knip coverage for the runner app**

In `knip.json`, add an `apps/remotion` workspace entry:

```json
"apps/remotion": {
  "entry": [
    "src/index.ts",
    "src/render.ts",
    "src/watch.ts",
    "remotion.config.ts"
  ],
  "project": ["src/**/*.{ts,tsx}", "remotion.config.ts"]
},
```

Then remove this old line entirely:

```json
"ignoreWorkspaces": ["packages/remotion"],
```

Expected: Knip knows the app runner entrypoints and no longer ignores the
reusable Remotion package.

- [ ] **Step 15: Refresh workspace links**

Run:

```bash
pnpm install --lockfile-only
```

Expected: `pnpm-lock.yaml` gains an `apps/remotion` importer for
`@lightfast/remotion`, keeps `packages/remotion` for `@repo/remotion`, and no
longer contains a `packages/app-remotion` importer.

- [ ] **Step 16: Typecheck both packages**

Run:

```bash
pnpm --filter @repo/remotion typecheck
pnpm --filter @lightfast/remotion typecheck
```

Expected: both commands PASS.

- [ ] **Step 17: Commit the app runner split**

Run:

```bash
git status --short
git add apps/remotion packages/remotion package.json knip.json pnpm-lock.yaml
git commit -m "refactor(remotion): split runner app from package"
```

Expected: commit succeeds. The old `packages/app-remotion` path should have no
tracked files remaining.

## Task 3: Validate Render Behavior And Stale References

**Files:**
- Verify: `apps/remotion/out/brand/brand-geometry.png`
- Verify: `package.json`
- Verify: `knip.json`
- Verify: `pnpm-lock.yaml`
- Verify: `apps/remotion/**`
- Verify: `packages/remotion/**`

- [ ] **Step 1: Check for stale source references**

Run:

```bash
rg -n "@repo/app-remotion|packages/app-remotion" package.json pnpm-lock.yaml knip.json apps packages vendor
```

Expected: `rg` exits with no matches.

- [ ] **Step 2: Check package names**

Run:

```bash
pnpm --filter @repo/remotion typecheck
pnpm --filter @lightfast/remotion typecheck
```

Expected: both commands PASS, proving pnpm can resolve both renamed packages.

- [ ] **Step 3: Render one still through the app runner**

Run:

```bash
pnpm --filter @lightfast/remotion render:stills -- --id brand-geometry
```

Expected output includes:

```text
Bundling compositions...
Rendering brand-geometry
```

Expected file:

```bash
test -f apps/remotion/out/brand/brand-geometry.png
```

The `test` command exits with status 0.

- [ ] **Step 4: Confirm generated output is not staged**

Run:

```bash
git status --short apps/remotion/out packages/remotion/out
```

Expected: no staged files. If generated output appears as untracked files, do
not add it unless the repo already tracks that specific artifact class.

- [ ] **Step 5: Run the root helper script against the app runner**

Run:

```bash
pnpm remotion:render -- --only stills --id brand-geometry
```

Expected: the command invokes `@lightfast/remotion` and renders the same
`brand-geometry` still.

- [ ] **Step 6: Commit validation-only fixes if needed**

If the validation steps required code changes, commit them:

```bash
git status --short
git add apps/remotion packages/remotion package.json knip.json pnpm-lock.yaml
git commit -m "fix(remotion): validate runner split"
```

Expected: create this commit only if validation required source changes. If no
source changes were needed, skip the commit.

## Task 4: Handoff For Paper MCP Stills

**Files:**
- Read: `docs/superpowers/specs/2026-06-23-remotion-runner-split-design.md`
- Read: `packages/remotion/src/compositions/brand-geometry/brand-geometry.tsx`
- Read: `packages/remotion/src/compositions/logo/logo.tsx`
- Read: `packages/ui-v2/src/components/brand/logo.tsx`

- [ ] **Step 1: Confirm the runner split is complete**

Run:

```bash
pnpm --filter @repo/remotion typecheck
pnpm --filter @lightfast/remotion typecheck
```

Expected: both commands PASS.

- [ ] **Step 2: Confirm the expected next compositions are not present yet**

Run:

```bash
rg -n "brilliant-mist-logo-square-clearspace-dark|brand-partnership-clearspace-dark" packages/remotion/src apps/remotion/src
```

Expected: `rg` exits with no matches before the Paper MCP migration begins.

- [ ] **Step 3: Prepare the next planning prompt**

Use this prompt for the next design/planning step:

```text
Now that Remotion is split into apps/remotion and packages/remotion, inspect the Paper MCP designs brilliant mist logo-square-clearspace-dark and brand-partnership-clearspace-dark, then plan their migration as first-class @repo/remotion still compositions rendered by @lightfast/remotion.
```

Expected: the Paper MCP stills are handled as a separate implementation plan
with exact visual dimensions and layout constants from the Paper design nodes.
