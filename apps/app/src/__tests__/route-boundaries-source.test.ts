import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

function expectSource(path: string) {
  expect(existsSync(resolve(appRoot, path)), `${path} should exist`).toBe(true);
  return source(path);
}

function routeFilesWithPendingComponents() {
  const routesRoot = resolve(appRoot, "src/routes");
  const routeFiles: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory)) {
      const fullPath = join(directory, entry);
      if (statSync(fullPath).isDirectory()) {
        visit(fullPath);
        continue;
      }
      if (!entry.endsWith(".tsx")) {
        continue;
      }
      const routeFile = relative(appRoot, fullPath);
      if (source(routeFile).includes("pendingComponent:")) {
        routeFiles.push(routeFile);
      }
    }
  };

  visit(routesRoot);
  return routeFiles.sort();
}

describe("app route boundaries", () => {
  it("defines reusable TanStack route pending and error shells", () => {
    const boundarySource = expectSource("src/components/route-boundaries.tsx");

    expect(boundarySource).toContain('from "@sentry/tanstackstart-react"');
    expect(boundarySource).toContain("useRouter");
    expect(boundarySource).toContain("router.invalidate");
    expect(boundarySource).toContain("captureException");
    expect(boundarySource).toContain('role="status"');
    expect(boundarySource).toContain("aria-label={label}");
  });

  it("wires route-level pending and error boundaries where Next had segment shells", () => {
    const routeFiles = [
      "src/routes/_authenticated/$slug/chat/index.tsx",
      "src/routes/_authenticated/$slug/chat/$conversationId.tsx",
      "src/routes/_authenticated/$slug/automations/new.tsx",
      "src/routes/_authenticated/$slug/automations/$automation.tsx",
      "src/routes/_authenticated/$slug/settings/billing.tsx",
    ];

    for (const routeFile of routeFiles) {
      const routeSource = expectSource(routeFile);

      expect(routeSource).toContain("pendingComponent:");
      expect(routeSource).toContain("errorComponent:");
      expect(routeSource).toContain("RouteError");
      expect(routeSource).not.toContain("next/");
    }
  });

  it("wires product workspace list routes with pending and error boundaries", () => {
    const routeFiles = [
      "src/routes/_authenticated/$slug/people.tsx",
      "src/routes/_authenticated/$slug/signals.tsx",
      "src/routes/_authenticated/$slug/decisions.tsx",
      "src/routes/_authenticated/$slug/automations/index.tsx",
    ];

    for (const routeFile of routeFiles) {
      const routeSource = expectSource(routeFile);

      expect(routeSource).toContain("pendingComponent:");
      expect(routeSource).toContain("errorComponent:");
      expect(routeSource).toContain("WorkspaceRouteErrorPanel");
      expect(routeSource).toContain("pendingMs: 0");
      expect(routeSource).toContain("pendingMinMs: 0");
      expect(routeSource).not.toContain("pendingMs: 250");
      expect(routeSource).not.toContain("pendingMinMs: 250");
      expect(routeSource).not.toContain("next/");
    }
  });

  it("shows every route pending boundary immediately", () => {
    const routeFiles = routeFilesWithPendingComponents();

    expect(routeFiles).toContain(
      "src/routes/_authenticated/$slug/chat/index.tsx"
    );
    expect(routeFiles).toContain(
      "src/routes/_authenticated/$slug/decisions.tsx"
    );

    for (const routeFile of routeFiles) {
      const routeSource = expectSource(routeFile);

      expect(routeSource, `${routeFile} pendingMs`).toContain("pendingMs: 0");
      expect(routeSource, `${routeFile} pendingMinMs`).toContain(
        "pendingMinMs: 0"
      );
    }
  });

  it("wires loading shells for settings routes with async prefetch loaders", () => {
    const routeFiles = [
      "src/routes/_authenticated/$slug/settings/source-control.tsx",
      "src/routes/_authenticated/$slug/settings/members.tsx",
      "src/routes/_authenticated/$slug/settings/api-keys.tsx",
    ];

    for (const routeFile of routeFiles) {
      const routeSource = expectSource(routeFile);

      expect(routeSource).toContain("pendingComponent:");
      expect(routeSource).toContain("WorkspaceRoutePending");
      expect(routeSource).not.toContain("next/");
    }
  });
});
