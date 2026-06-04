import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);
const configPath = path.join(appRoot, "microfrontends.json");

interface MicrofrontendsConfig {
  applications: Record<
    string,
    {
      packageName: string;
      routing?: Array<{
        group?: string;
        paths: string[];
      }>;
    }
  >;
}

function readConfig(): MicrofrontendsConfig {
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function pathsFor(config: MicrofrontendsConfig, appName: string) {
  return new Set(
    config.applications[appName]?.routing?.flatMap((group) => group.paths) ?? []
  );
}

describe("microfrontends config", () => {
  it("routes migrated marketing surfaces to www-start and keeps app as default", () => {
    const config = readConfig();

    expect(config.applications["lightfast-app"]?.routing).toBeUndefined();
    expect(config.applications["lightfast-www-start"]?.packageName).toBe(
      "@lightfast/www-start"
    );

    const startPaths = [...pathsFor(config, "lightfast-www-start")];
    expect(startPaths).toEqual(
      expect.arrayContaining([
        "/",
        "/pricing",
        "/use-cases/:path*",
        "/legal/:path*",
        "/search",
        "/blog",
        "/blog/:path*",
        "/changelog",
        "/changelog/:path*",
        "/company",
        "/careers",
        "/docs",
        "/docs/get-started/overview",
        "/sitemap.xml",
        "/robots.txt",
        "/llms.txt",
        "/favicon.svg",
        "/manifest.json",
        "/src/:path*",
        "/@id/:path*",
        "/@vite/:path*",
        "/@react-refresh",
        "/@tanstack-start/:path*",
        "/node_modules/:path*",
      ])
    );
  });

  it("keeps unmigrated marketing routes on the old www app without route overlap", () => {
    const config = readConfig();
    const startPaths = pathsFor(config, "lightfast-www-start");
    const oldWwwPaths = pathsFor(config, "lightfast-www");

    expect([...oldWwwPaths]).toEqual(
      expect.arrayContaining([
        "/api/search",
        "/docs/get-started/quickstart",
        "/docs/integrate/:path*",
        "/docs/api-reference/:path*",
        "/manifest.webmanifest",
      ])
    );

    for (const route of startPaths) {
      expect(oldWwwPaths.has(route)).toBe(false);
    }
  });
});
