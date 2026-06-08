import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const appRoot = resolve(import.meta.dirname, "../..");

describe("app-tanstack workspace wiring", () => {
  it("has a distinct package and Portless service name", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(appRoot, "package.json"), "utf8")
    ) as { name: string; portless: string };
    const portlessJson = JSON.parse(
      readFileSync(resolve(appRoot, "portless.json"), "utf8")
    ) as { name: string };

    expect(packageJson.name).toBe("@lightfast/app-tanstack");
    expect(packageJson.portless).toBe("app-tanstack.lightfast");
    expect(portlessJson.name).toBe("app-tanstack.lightfast");
  });

  it("keeps root pnpm dev on the current Next app while desktop auth is debugged", () => {
    const rootPackageJson = JSON.parse(
      readFileSync(resolve(repoRoot, "package.json"), "utf8")
    ) as { scripts: Record<string, string> };

    expect(rootPackageJson.scripts.dev).toContain("-F @lightfast/app");
    expect(rootPackageJson.scripts.dev).toContain("@lightfast/app#mfe:proxy");
    expect(rootPackageJson.scripts.dev).not.toContain(
      "-F @lightfast/app-tanstack"
    );
    expect(rootPackageJson.scripts.dev).not.toContain(
      "@lightfast/app-tanstack#mfe:proxy"
    );
  });

  it("does not carry a temporary MFE mesh while app-tanstack is promoted elsewhere", () => {
    expect(existsSync(resolve(appRoot, "microfrontends.json"))).toBe(false);
  });

  it("injects aggregate app URLs into the direct TanStack dev server", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(appRoot, "package.json"), "utf8")
    ) as {
      dependencies: Record<string, string | undefined>;
      scripts: Record<string, string | undefined>;
    };

    expect(packageJson.scripts["mfe:proxy"]).toBeUndefined();
    expect(packageJson.dependencies["@vercel/microfrontends"]).toBeUndefined();
    expect(packageJson.scripts["with-related-projects"]).toContain(
      "NEXT_PUBLIC_APP_URL=$(portless get lightfast)"
    );
    expect(packageJson.scripts["with-related-projects"]).toContain(
      "VITE_LIGHTFAST_APP_URL=$(portless get lightfast)"
    );
  });

  it("reuses the current app Vercel env instead of requiring a temporary project", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(appRoot, "package.json"), "utf8")
    ) as { scripts: Record<string, string> };
    const setupScript = readFileSync(
      resolve(repoRoot, "scripts/cloud/setup.sh"),
      "utf8"
    );

    expect(packageJson.scripts["with-env"]).toContain(
      "../app/.vercel/.env.development.local"
    );
    expect(packageJson.scripts["with-env:local"]).toContain(
      "../app/.vercel/.env.development.local"
    );
    expect(setupScript).not.toContain(
      "LIGHTFAST_VERCEL_PROJECT_ID_APP_TANSTACK"
    );
    expect(setupScript).not.toContain("apps/app-tanstack|");
    expect(setupScript).toContain(
      "final cutover keeps the existing lightfast-app Vercel project/env graph"
    );
  });

  it("declares the same related Vercel sibling projects as the current app", () => {
    const appVercelJson = JSON.parse(
      readFileSync(resolve(repoRoot, "apps/app/vercel.json"), "utf8")
    ) as { relatedProjects: string[] };
    const tanstackVercelJson = JSON.parse(
      readFileSync(resolve(appRoot, "vercel.json"), "utf8")
    ) as {
      framework: string;
      relatedProjects: string[];
    };

    expect(tanstackVercelJson.framework).toBe("tanstack-start");
    expect(tanstackVercelJson.relatedProjects).toEqual(
      appVercelJson.relatedProjects
    );
  });
});
