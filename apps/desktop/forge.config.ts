import { resolve } from "node:path";
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { MakerDMG } from "@electron-forge/maker-dmg";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { PublisherGithub } from "@electron-forge/publisher-github";
import type { ForgeConfig } from "@electron-forge/shared-types";

const BUNDLE_ID = "ai.lightfast.desktop";
const URL_SCHEME = "lightfast";

const osxSign =
  process.env.APPLE_SIGNING_IDENTITY && process.env.APPLE_TEAM_ID
    ? {
        identity: process.env.APPLE_SIGNING_IDENTITY,
        "hardened-runtime": true,
        "gatekeeper-assess": false,
        entitlements: resolve(
          import.meta.dirname,
          "build/entitlements.mac.plist"
        ),
        "entitlements-inherit": resolve(
          import.meta.dirname,
          "build/entitlements.mac.inherit.plist"
        ),
        "signature-flags": "library",
      }
    : undefined;

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

const [publishOwner, publishRepo] = (
  process.env.LIGHTFAST_DESKTOP_RELEASE_REPO ?? ""
).split("/");

const githubPublisher =
  process.env.GITHUB_TOKEN && publishOwner && publishRepo
    ? new PublisherGithub({
        repository: { owner: publishOwner, name: publishRepo },
        draft: true,
        prerelease: process.env.LIGHTFAST_DESKTOP_RELEASE_PRERELEASE === "true",
      })
    : null;

const config: ForgeConfig = {
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
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: "lightfast",
      setupIcon: resolve(import.meta.dirname, "build/icon.ico"),
    }),
    new MakerZIP({}, ["darwin"]),
    new MakerDMG({
      format: "ULFO",
    }),
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
          entry: "src/preload/preload.ts",
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
