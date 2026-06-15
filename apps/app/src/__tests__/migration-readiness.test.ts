import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const nextAppRoot = resolve(repoRoot, "apps/app-next");
const tanstackAppRoot = resolve(repoRoot, "apps/app");

function readWorkspaceFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

function walkFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = resolve(dir, entry);
    if (statSync(path).isDirectory()) {
      return walkFiles(path);
    }
    return [path];
  });
}

function stripTrailingSlash(path: string) {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

function normalizeNextSegment(segment: string) {
  if (segment === "[...not-found]") {
    return null;
  }
  if (segment.startsWith("(") && segment.endsWith(")")) {
    return null;
  }
  if (segment.startsWith("@")) {
    return null;
  }
  if (segment.startsWith("[[...") && segment.endsWith("]]")) {
    return "$";
  }
  if (segment.startsWith("[...") && segment.endsWith("]")) {
    return "$";
  }
  if (segment.startsWith("[") && segment.endsWith("]")) {
    return `$${segment.slice(1, -1)}`;
  }
  return segment;
}

function normalizeAddressableRoute(path: string) {
  return stripTrailingSlash(path)
    .split("/")
    .map((segment) => {
      const publicSegment = segment.endsWith("_")
        ? segment.slice(0, -1)
        : segment;
      return publicSegment.replace(/^\$[A-Za-z0-9]+$/, "$");
    })
    .join("/");
}

function nextAddressableRoutes() {
  const appDir = resolve(nextAppRoot, "src/app");
  expect(existsSync(appDir), "legacy Next app routes should exist").toBe(true);
  return walkFiles(appDir)
    .filter((path) => path.endsWith("/page.tsx") || path.endsWith("/route.ts"))
    .filter((path) => !path.includes("/@"))
    .map((path) => {
      const relative = path.slice(appDir.length + 1);
      const segments = relative.split("/").slice(0, -1);
      const normalizedSegments = segments.flatMap((segment) => {
        const normalized = normalizeNextSegment(segment);
        return normalized ? [normalized] : [];
      });
      return normalizeAddressableRoute(`/${normalizedSegments.join("/")}`);
    })
    .sort();
}

function tanstackRouteDeclarations() {
  const routeDir = resolve(tanstackAppRoot, "src/routes");
  expect(existsSync(routeDir), "TanStack app routes should exist").toBe(true);
  return walkFiles(routeDir)
    .filter((path) => /\.(ts|tsx)$/.test(path))
    .flatMap((path) => {
      const source = readFileSync(path, "utf8");
      return [
        ...source.matchAll(/createFileRoute\(\s*(['"`])([^'"`]+)\1/g),
      ].map((match) => {
        const route = match[2] ?? "/";
        const publicRoute = route.replace(/^\/_authenticated/, "") || "/";
        return normalizeAddressableRoute(publicRoute);
      });
    })
    .sort();
}

describe("app migration readiness", () => {
  it("declares TanStack routes for every addressable legacy Next route", () => {
    const nextRoutes = nextAddressableRoutes();
    const tanstackRoutes = new Set(tanstackRouteDeclarations());

    expect(nextRoutes.length).toBeGreaterThan(0);
    expect(tanstackRoutes.size).toBeGreaterThan(0);
    expect(
      nextRoutes.filter((route) => !tanstackRoutes.has(route))
    ).toStrictEqual([]);
  });

  it("keeps the TanStack app deployable under the old app environment surface", () => {
    const packageJson = JSON.parse(
      readWorkspaceFile("apps/app/package.json")
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    const envSource = readWorkspaceFile("apps/app/src/env.ts");
    const viteConfigSource = readWorkspaceFile("apps/app/vite.config.ts");
    const vercelConfig = JSON.parse(
      readWorkspaceFile("apps/app/vercel.json")
    ) as { framework?: string };

    expect(packageJson.dependencies?.next).toBeUndefined();
    expect(packageJson.devDependencies?.next).toBeUndefined();
    expect(packageJson.scripts?.["with-env"]).toContain(
      "./.vercel/.env.development.local"
    );
    expect(packageJson.scripts?.["with-env"]).toContain(
      "./.env.overrides.local"
    );
    expect(envSource).toMatch(
      /VITE_LIGHTFAST_APP_URL:\s*process\.env\.VITE_LIGHTFAST_APP_URL\s*\?\?\s*process\.env\.NEXT_PUBLIC_APP_URL/
    );
    expect(envSource).toMatch(
      /VITE_LIGHTFAST_WWW_URL:\s*process\.env\.VITE_LIGHTFAST_WWW_URL\s*\?\?\s*process\.env\.NEXT_PUBLIC_WWW_URL/
    );
    expect(envSource).toMatch(
      /VITE_CLERK_PUBLISHABLE_KEY:\s*process\.env\.VITE_CLERK_PUBLISHABLE_KEY\s*\?\?\s*process\.env\.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY/
    );
    expect(envSource).toMatch(
      /VITE_SENTRY_DSN:\s*process\.env\.VITE_SENTRY_DSN\s*\?\?\s*process\.env\.NEXT_PUBLIC_SENTRY_DSN/
    );
    expect(viteConfigSource).toMatch(/plugins:\s*\[[\s\S]*tanstackStart\(\)/);
    expect(viteConfigSource).toMatch(/plugins:\s*\[[\s\S]*sentryTanstackStart/);
    expect(vercelConfig.framework).toBe("tanstack-start");
    expect(existsSync(resolve(tanstackAppRoot, "src/server.ts"))).toBe(true);
  });
});
