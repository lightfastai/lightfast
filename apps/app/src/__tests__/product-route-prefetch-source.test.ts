import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

function routeFiles() {
  const routesRoot = resolve(appRoot, "src/routes");
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory)) {
      const fullPath = join(directory, entry);
      if (statSync(fullPath).isDirectory()) {
        visit(fullPath);
        continue;
      }
      if (entry.endsWith(".tsx")) {
        files.push(relative(appRoot, fullPath));
      }
    }
  };

  visit(routesRoot);
  return files.sort();
}

describe("app route prefetch policy", () => {
  it("keeps route navigation free of server-side data prefetch hydration", () => {
    const removedPrefetchFiles = [
      "src/account/account-route-prefetch.ts",
      "src/automations/automations-route-prefetch.ts",
      "src/connectors/connectors-route-prefetch.ts",
      "src/decisions/decisions-route-prefetch.ts",
      "src/org/org-route-prefetch.ts",
      "src/people/people-route-prefetch.ts",
      "src/signals/signals-route-prefetch.ts",
      "src/skills/skills-route-prefetch.ts",
      "src/trpc/route-prefetch-types.ts",
      "src/trpc/route-prefetch.tsx",
    ];

    for (const file of removedPrefetchFiles) {
      expect(existsSync(resolve(appRoot, file)), `${file} should be gone`).toBe(
        false
      );
    }

    for (const routeFile of routeFiles()) {
      const routeSource = source(routeFile);

      expect(routeSource, routeFile).not.toContain("loadRoutePrefetch");
      expect(routeSource, routeFile).not.toContain("RoutePrefetchBoundary");
      expect(routeSource, routeFile).not.toContain("~/trpc/route-prefetch");
    }
  });

  it("does not precreate new chat conversations during intent preload", () => {
    const sidebarSource = source("src/components/app-sidebar.tsx");

    expect(sidebarSource).toContain('aria-label="New chat"');
    expect(sidebarSource).toContain('to="/$slug/chat"');
    expect(sidebarSource).toContain("preload={false}");
    expect(sidebarSource).not.toContain("const navigate = useNavigate();");
  });
});
