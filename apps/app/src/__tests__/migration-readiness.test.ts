import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const tanstackAppRoot = resolve(repoRoot, "apps/app");

const migratedNextAppRoutes = [
  "/$",
  "/$/automations",
  "/$/automations/$",
  "/$/automations/new",
  "/$/chat",
  "/$/chat/$",
  "/$/connectors",
  "/$/decisions",
  "/$/developer-connections",
  "/$/people",
  "/$/settings",
  "/$/settings/api-keys",
  "/$/settings/billing",
  "/$/settings/mcp",
  "/$/settings/members",
  "/$/settings/source-control",
  "/$/signals",
  "/$/skills",
  "/$/tasks/bind",
  "/$/tasks/bind/github/complete",
  "/$/tasks/connectors/x",
  "/$/tasks/connectors/x/complete",
  "/$/tasks/github/lightfast-repo",
  "/.well-known/oauth-authorization-server",
  "/account",
  "/account/mcp",
  "/account/settings",
  "/account/settings/general",
  "/account/settings/source-control",
  "/account/tasks/github",
  "/account/tasks/github/complete",
  "/account/tasks/username",
  "/account/teams/new",
  "/api/chat",
  "/api/chat/$/stream",
  "/api/connectors/granola/oauth/callback",
  "/api/connectors/linear/oauth/callback",
  "/api/connectors/x/mcp",
  "/api/connectors/x/oauth/callback",
  "/api/github/oauth/callback",
  "/api/github/setup",
  "/api/github/user/oauth/callback",
  "/api/github/webhook",
  "/api/health",
  "/api/inngest",
  "/api/internal/mcp/proxy/call",
  "/api/internal/mcp/proxy/find",
  "/api/internal/mcp/signals",
  "/api/internal/mcp/signals/get",
  "/api/native/proxy/call",
  "/api/native/proxy/routines",
  "/api/oauth/$/config",
  "/api/oauth/finalize",
  "/api/skills/index/events",
  "/api/trpc/$",
  "/api/v1/$",
  "/api/v1/signals",
  "/api/v1/signals/$",
  "/api/v1/system/health",
  "/oauth/$/start",
  "/oauth/authorize",
  "/oauth/jwks",
  "/oauth/register",
  "/oauth/register/$",
  "/oauth/revoke",
  "/oauth/token",
  "/sign-in",
  "/sign-up",
  "/sign-up/accept-invitation",
] as const;

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
  it("declares TanStack routes for every migrated legacy Next route", () => {
    const tanstackRoutes = new Set(tanstackRouteDeclarations());

    expect(migratedNextAppRoutes.length).toBe(69);
    expect(tanstackRoutes.size).toBeGreaterThan(0);
    expect(
      migratedNextAppRoutes.filter((route) => !tanstackRoutes.has(route))
    ).toStrictEqual([]);
  });

  it("removes the archived Next.js app workspace after promotion", () => {
    expect(existsSync(resolve(repoRoot, "apps/app-next"))).toBe(false);
  });

  it("keeps the TanStack app deployable with Vite environment names", () => {
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
      /VITE_LIGHTFAST_APP_URL:\s*process\.env\.VITE_LIGHTFAST_APP_URL/
    );
    expect(envSource).not.toContain("VITE_LIGHTFAST_WWW_URL");
    expect(envSource).toContain(
      "VITE_CLERK_PUBLISHABLE_KEY: process.env.VITE_CLERK_PUBLISHABLE_KEY"
    );
    expect(envSource).toContain("VITE_SENTRY_DSN: process.env.VITE_SENTRY_DSN");
    expect(envSource).not.toContain("NEXT_PUBLIC_");
    expect(viteConfigSource).toMatch(/plugins:\s*\[[\s\S]*tanstackStart\(\)/);
    expect(viteConfigSource).toMatch(/plugins:\s*\[[\s\S]*sentryTanstackStart/);
    expect(vercelConfig.framework).toBe("tanstack-start");
    expect(existsSync(resolve(tanstackAppRoot, "src/server.ts"))).toBe(true);
  });
});
