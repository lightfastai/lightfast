import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { organization } from "../index";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.."
);

function isRouteGroup(segment: string): boolean {
  return segment.startsWith("(") && segment.endsWith(")");
}

function isDynamicSegment(segment: string): boolean {
  return segment.startsWith("[") || segment.startsWith("$");
}

function isPrivateSegment(segment: string): boolean {
  return segment.startsWith("_");
}

function normalizeTanStackRouteSegment(segment: string): string | null {
  const normalized = segment.replaceAll("[.]", ".").replace(/_$/, "");
  if (
    !normalized ||
    normalized === "__root" ||
    normalized === "index" ||
    isRouteGroup(normalized) ||
    isPrivateSegment(normalized)
  ) {
    return null;
  }

  return normalized;
}

function splitTanStackRoutePart(segment: string): string[] {
  const escapedDot = "\0tanstack-dot\0";
  return segment
    .replaceAll("[.]", escapedDot)
    .split(".")
    .map((part) => part.replaceAll(escapedDot, "[.]"));
}

function collectTanStackTopLevelRouteSegments(routesRoot: string): Set<string> {
  const segments = new Set<string>();
  if (!fs.existsSync(routesRoot)) {
    return segments;
  }

  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
        continue;
      }

      if (!/\.(?:ts|tsx)$/.test(entry.name)) {
        continue;
      }

      const routePath = path
        .relative(routesRoot, entryPath)
        .replace(/\.(?:ts|tsx)$/, "");
      const routeSegments = routePath
        .split(path.sep)
        .flatMap((segment) => splitTanStackRoutePart(segment));

      for (const routeSegment of routeSegments) {
        const normalized = normalizeTanStackRouteSegment(routeSegment);
        if (!normalized) {
          continue;
        }
        if (isDynamicSegment(normalized)) {
          break;
        }

        segments.add(normalized);
        break;
      }
    }
  };

  visit(routesRoot);
  return segments;
}

function normalizeMicrofrontendSegment(segment: string): string | null {
  if (segment.startsWith(":")) {
    return null;
  }
  const dynamicIndex = segment.indexOf(":");
  if (dynamicIndex === -1) {
    return segment;
  }
  const staticPrefix = segment.slice(0, dynamicIndex).replace(/[-_]+$/, "");
  return staticPrefix || null;
}

function collectMicrofrontendRouteSegments(): Set<string> {
  const configPath = path.join(repoRoot, "apps/app/microfrontends.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8")) as {
    applications: Record<string, { routing?: Array<{ paths?: string[] }> }>;
  };
  const segments = new Set<string>();
  for (const application of Object.values(config.applications)) {
    for (const routeGroup of application.routing ?? []) {
      for (const route of routeGroup.paths ?? []) {
        for (const rawSegment of route.split("/").filter(Boolean)) {
          const segment = normalizeMicrofrontendSegment(rawSegment);
          if (segment) {
            segments.add(segment);
          }
        }
      }
    }
  }
  return segments;
}

function collectCurrentStaticRouteSegments(): string[] {
  return [
    ...new Set([
      ...collectTanStackTopLevelRouteSegments(
        path.join(repoRoot, "apps/app/src/routes")
      ),
      ...collectMicrofrontendRouteSegments(),
    ]),
  ].sort();
}

const deployedMarketingNames = [
  "blog",
  "brand",
  "company",
  "home",
  "legal",
  "privacy",
  "terms",
] as const;

describe("current route coverage", () => {
  const currentStaticRouteSegments = collectCurrentStaticRouteSegments();

  it("reserves every static app and deployed MFE route segment", () => {
    expect(
      currentStaticRouteSegments.filter(
        (segment) => !organization.check(segment)
      )
    ).toEqual([]);
  });
});

describe("deployed marketing name coverage", () => {
  it("retains stable public website names without reading another repository", () => {
    expect(
      deployedMarketingNames.filter((name) => !organization.check(name))
    ).toEqual([]);
  });
});
