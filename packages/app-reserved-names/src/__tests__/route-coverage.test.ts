import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { organization } from "../index";

const routeArtifactNames = new Set([
  "layout.tsx",
  "manifest.ts",
  "opengraph-image.tsx",
  "page.tsx",
  "robots.ts",
  "route.ts",
  "route.tsx",
  "sitemap.ts",
]);

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.."
);

function findRouteArtifacts(root: string): string[] {
  const artifacts: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      artifacts.push(...findRouteArtifacts(entryPath));
      continue;
    }
    if (routeArtifactNames.has(entry.name)) {
      artifacts.push(entryPath);
    }
  }
  return artifacts;
}

function isRouteGroup(segment: string): boolean {
  return segment.startsWith("(") && segment.endsWith(")");
}

function isDynamicSegment(segment: string): boolean {
  return segment.startsWith("[");
}

function isPrivateSegment(segment: string): boolean {
  return segment.startsWith("_");
}

function addMetadataRouteSegment(
  segments: Set<string>,
  artifactName: string
): void {
  if (artifactName === "manifest.ts") {
    segments.add("manifest");
    segments.add("manifest.webmanifest");
  }
  if (artifactName === "opengraph-image.tsx") {
    segments.add("opengraph-image");
  }
  if (artifactName === "robots.ts") {
    segments.add("robots.txt");
  }
  if (artifactName === "sitemap.ts") {
    segments.add("sitemap.xml");
  }
}

function collectAppRouteSegments(appRoot: string): Set<string> {
  const segments = new Set<string>();
  for (const artifactPath of findRouteArtifacts(appRoot)) {
    const routeDir = path.dirname(path.relative(appRoot, artifactPath));
    if (routeDir !== ".") {
      for (const segment of routeDir.split(path.sep)) {
        if (
          segment &&
          !isRouteGroup(segment) &&
          !isDynamicSegment(segment) &&
          !isPrivateSegment(segment)
        ) {
          segments.add(segment);
        }
      }
    }
    addMetadataRouteSegment(segments, path.basename(artifactPath));
  }
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
      ...collectAppRouteSegments(path.join(repoRoot, "apps/app/src/app")),
      ...collectAppRouteSegments(path.join(repoRoot, "apps/www/src/app")),
      ...collectMicrofrontendRouteSegments(),
    ]),
  ].sort();
}

function addContentPathSegments(segments: Set<string>, href: string): void {
  if (
    !(href.startsWith("/") || href.startsWith("./") || href.startsWith("../"))
  ) {
    return;
  }
  for (const segment of href.split(/[/?#]/)[0]?.split("/") ?? []) {
    if (
      segment &&
      segment !== "." &&
      segment !== ".." &&
      !isDynamicSegment(segment)
    ) {
      segments.add(segment);
    }
  }
}

function addMetaPageSegment(segments: Set<string>, page: unknown): void {
  if (typeof page !== "string" || page === "index") {
    return;
  }
  const markdownHref = /\]\(([^)]+)\)/.exec(page)?.[1];
  if (markdownHref) {
    addContentPathSegments(segments, markdownHref);
    return;
  }
  addContentPathSegments(segments, page.startsWith("/") ? page : `/${page}`);
}

function collectContentSourceSegments(): Set<string> {
  const segments = new Set<string>();
  const contentRoots = [
    path.join(repoRoot, "apps/www/src/content/api"),
    path.join(repoRoot, "apps/www/src/content/docs"),
    path.join(repoRoot, "apps/www/src/content/legal"),
  ];

  for (const contentRoot of contentRoots) {
    const visit = (directory: string) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          segments.add(entry.name);
          visit(entryPath);
          continue;
        }
        if (entry.name === "meta.json") {
          const meta = JSON.parse(fs.readFileSync(entryPath, "utf8")) as {
            pages?: unknown[];
          };
          for (const page of meta.pages ?? []) {
            addMetaPageSegment(segments, page);
          }
          continue;
        }
        if (entry.name.endsWith(".mdx")) {
          segments.add(entry.name.replace(/\.mdx$/, ""));
        }
      }
    };
    visit(contentRoot);
  }

  const blogCategoriesPath = path.join(
    repoRoot,
    "apps/www/src/config/blog-categories.ts"
  );
  const blogCategoriesSource = fs.readFileSync(blogCategoriesPath, "utf8");
  for (const match of blogCategoriesSource.matchAll(/slug:\s*"([^"]+)"/g)) {
    segments.add(match[1]!);
  }

  return segments;
}

describe("current route coverage", () => {
  const currentStaticRouteSegments = collectCurrentStaticRouteSegments();

  it("reserves every static app/www route segment for organization slugs", () => {
    expect(
      currentStaticRouteSegments.filter(
        (segment) => !organization.check(segment)
      )
    ).toEqual([]);
  });
});

describe("current content coverage", () => {
  const currentContentSegments = [...collectContentSourceSegments()].sort();

  it("reserves docs, legal, and category content slugs for organization slugs", () => {
    expect(
      currentContentSegments.filter((segment) => !organization.check(segment))
    ).toEqual([]);
  });
});
