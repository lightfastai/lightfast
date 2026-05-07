import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerDMG } from "@electron-forge/maker-dmg";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { PublisherGithub } from "@electron-forge/publisher-github";
import type { ForgeConfig } from "@electron-forge/shared-types";

const BUNDLE_ID = "ai.lightfast.lightfast";
const URL_SCHEME = "lightfast";

const osxSign =
  process.env.APPLE_SIGNING_IDENTITY && process.env.APPLE_TEAM_ID
    ? {
        identity: process.env.APPLE_SIGNING_IDENTITY,
        entitlements: resolve(
          import.meta.dirname,
          "build/entitlements.mac.plist"
        ),
        entitlementsInherit: resolve(
          import.meta.dirname,
          "build/entitlements.mac.inherit.plist"
        ),
        optionsForFile: () => ({
          hardenedRuntime: true,
          gatekeeperAssess: false,
          signatureFlags: "library",
        }),
      }
    : // Ad-hoc fallback used while waiting on Apple Developer enrollment.
      // identity:"-" alone produces an unsigned bundle: osx-sign defaults
      // identityValidation:true, runs `security find-identity -v -`, finds
      // nothing, throws, forge swallows. Bundle then SIGKILLs at launch
      // (Code Signature Invalid) once FusesPlugin patches the binary.
      // hardenedRuntime must go through optionsForFile — mergeOptionsForFile
      // ignores top-level hardenedRuntime. Library validation rejects sibling
      // frameworks under hardened runtime because ad-hoc DRs are content-bound.
      {
        identity: "-",
        identityValidation: false,
        optionsForFile: () => ({ hardenedRuntime: false }),
        preAutoEntitlements: false,
        preEmbedProvisioningProfile: false,
      };

const osxNotarize =
  process.env.APPLE_API_KEY &&
  process.env.APPLE_API_KEY_ID &&
  process.env.APPLE_API_ISSUER
    ? {
        appleApiKey: process.env.APPLE_API_KEY,
        appleApiKeyId: process.env.APPLE_API_KEY_ID,
        appleApiIssuer: process.env.APPLE_API_ISSUER,
      }
    : undefined;

const githubPublisher = process.env.GITHUB_TOKEN
  ? new PublisherGithub({
      repository: { owner: "lightfastai", name: "lightfast" },
      draft: true,
      prerelease: process.env.LIGHTFAST_DESKTOP_RELEASE_PRERELEASE === "true",
      // Forge defaults tagPrefix to "v", which would create a parallel
      // release at v<version>. The workflow's prepare job already created a
      // draft at @lightfast/desktop@<version>; matching tagPrefix here makes
      // Forge publish assets onto that release instead of a sibling.
      tagPrefix: "@lightfast/desktop@",
    })
  : null;

// Inject sentry debug-ids into the staged Vite output AFTER electron-packager
// has copied it to its temp build path. We can't use prePackage because
// Forge runs user hooks before plugin-vite's build, so .vite/ doesn't exist
// yet. We can't use any earlier post-Vite hook because plugin-vite doesn't
// expose one. packageAfterCopy fires once per platform/arch with `buildPath`
// pointing at the staging dir whose contents will be sealed into the asar;
// inject there, then mirror the modified files back to the source `.vite/`
// so `scripts/upload-sourcemaps.mjs` uploads sourcemaps with debug-ids that
// match what got packed.
// plugin-vite's resolveForgeConfig defaults packagerConfig.ignore to allow
// only `/.vite/...`, so node_modules is never copied. AutoUnpackNativesPlugin
// then has no .node files to unpack. Copy better-sqlite3 + its runtime
// transitive deps into <buildPath>/node_modules/ ourselves; AutoUnpack will
// take it from there.
const NATIVE_RUNTIME_MODULES = [
  "better-sqlite3",
  "bindings",
  "file-uri-to-path",
];

function copyNativeRuntimeModules(buildPath: string, sourceRoot: string): void {
  const requireFromSource = createRequire(resolve(sourceRoot, "package.json"));
  const targetNodeModules = resolve(buildPath, "node_modules");
  mkdirSync(targetNodeModules, { recursive: true });

  // Resolve transitively: better-sqlite3 from sourceRoot; bindings from
  // inside better-sqlite3; file-uri-to-path from inside bindings.
  const resolveDir = (name: string, fromDir: string): string => {
    const fromRequire = createRequire(resolve(fromDir, "package.json"));
    return dirname(fromRequire.resolve(`${name}/package.json`));
  };

  let from = sourceRoot;
  for (const name of NATIVE_RUNTIME_MODULES) {
    const sourceDir =
      name === "better-sqlite3"
        ? dirname(requireFromSource.resolve(`${name}/package.json`))
        : resolveDir(name, from);
    const targetDir = resolve(targetNodeModules, name);
    cpSync(sourceDir, targetDir, {
      recursive: true,
      dereference: true,
    });
    from = sourceDir;
  }
}

function injectSentryDebugIds(buildPath: string, sourceRoot: string): void {
  if (!process.env.SENTRY_AUTH_TOKEN) {
    return;
  }
  const targets = [".vite/build", ".vite/renderer/main_window"];
  for (const t of targets) {
    const stagingDir = resolve(buildPath, t);
    const sourceDir = resolve(sourceRoot, t);
    if (!existsSync(stagingDir)) {
      continue;
    }
    execFileSync(
      "pnpm",
      ["exec", "sentry-cli", "sourcemaps", "inject", stagingDir],
      { cwd: sourceRoot, stdio: "inherit" }
    );
    if (existsSync(sourceDir)) {
      cpSync(stagingDir, sourceDir, { recursive: true, force: true });
    }
  }
}

const config: ForgeConfig = {
  hooks: {
    packageAfterCopy: async (_forgeConfig, buildPath) => {
      copyNativeRuntimeModules(buildPath, import.meta.dirname);
      injectSentryDebugIds(buildPath, import.meta.dirname);
    },
  },
  packagerConfig: {
    name: "Lightfast",
    executableName: "lightfast",
    appBundleId: BUNDLE_ID,
    appCategoryType: "public.app-category.developer-tools",
    asar: true,
    icon: resolve(import.meta.dirname, "build/icon"),
    extraResource: ["src/main/assets"],
    ...(osxSign && { osxSign }),
    ...(osxNotarize && { osxNotarize }),
    extendInfo: {
      LSApplicationCategoryType: "public.app-category.developer-tools",
      LSMinimumSystemVersion: "12.0",
      NSHighResolutionCapable: true,
      NSSupportsAutomaticGraphicsSwitching: true,
      NSQuitAlwaysKeepsWindows: false,
      LSEnvironment: { MallocNanoZone: "0" },
      NSMicrophoneUsageDescription:
        "Used for voice notes and audio capture inside the app.",
      NSAudioCaptureUsageDescription:
        "Used for capturing system audio during sessions.",
      CFBundleURLTypes: [
        {
          CFBundleURLName: BUNDLE_ID,
          CFBundleURLSchemes: [URL_SCHEME],
        },
      ],
    },
    protocols: [{ name: "Lightfast", schemes: [URL_SCHEME] }],
  },
  rebuildConfig: {
    onlyModules: ["better-sqlite3"],
  },
  makers: [
    new MakerSquirrel({
      name: "lightfast",
      setupIcon: resolve(import.meta.dirname, "build/icon.ico"),
    }),
    new MakerZIP({}, ["darwin"]),
    new MakerDMG({
      format: "ULFO",
    }),
    new MakerDeb(
      {
        options: {
          name: "lightfast",
          // electron-installer-common defaults `bin` to `pkg.name`, which
          // becomes `@lightfast/desktop` after the release workflow runs
          // `npm version`. The actual binary on disk is `lightfast` (set via
          // `packagerConfig.executableName` above). Without this override the
          // maker fails: "could not find the Electron app binary at
          // .../Lightfast-linux-<arch>/@lightfast/desktop".
          bin: "lightfast",
          productName: "Lightfast",
          genericName: "Developer Tool",
          maintainer: "Lightfast <releases@lightfast.ai>",
          homepage: "https://lightfast.ai",
          categories: ["Development", "Utility"],
          icon: resolve(import.meta.dirname, "build/icon.png"),
        },
      },
      ["linux"]
    ),
    new MakerRpm(
      {
        options: {
          name: "lightfast",
          // Same `bin` override as MakerDeb above — electron-installer-redhat
          // shares the same `getDefaultsFromPackageJSON` helper.
          bin: "lightfast",
          productName: "Lightfast",
          genericName: "Developer Tool",
          license: "MIT",
          homepage: "https://lightfast.ai",
          categories: ["Development", "Utility"],
          icon: resolve(import.meta.dirname, "build/icon.png"),
        },
      },
      ["linux"]
    ),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      build: [
        {
          entry: "src/main/bootstrap.ts",
          config: "vite.main.config.ts",
          target: "main",
        },
        {
          entry: "src/preload/primary.ts",
          config: "vite.preload.config.ts",
          target: "preload",
        },
        {
          entry: "src/preload/settings.ts",
          config: "vite.preload.config.ts",
          target: "preload",
        },
        {
          entry: "src/preload/hud.ts",
          config: "vite.preload.config.ts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.ts",
        },
      ],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  publishers: githubPublisher ? [githubPublisher] : [],
};

export default config;
