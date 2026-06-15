import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const appRoot = resolve(import.meta.dirname, "../..");

describe("app workspace wiring", () => {
  it("owns the canonical app package and Portless service name", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(appRoot, "package.json"), "utf8")
    ) as { name: string; portless: string };
    const portlessJson = JSON.parse(
      readFileSync(resolve(appRoot, "portless.json"), "utf8")
    ) as { name: string };

    expect(packageJson.name).toBe("@lightfast/app");
    expect(packageJson.portless).toBe("app.lightfast");
    expect(portlessJson.name).toBe("app.lightfast");
  });

  it("keeps root pnpm dev on the canonical TanStack app", () => {
    const rootPackageJson = JSON.parse(
      readFileSync(resolve(repoRoot, "package.json"), "utf8")
    ) as { scripts: Record<string, string> };

    expect(rootPackageJson.scripts.dev).toContain("-F @lightfast/app");
    expect(rootPackageJson.scripts.dev).toContain("@lightfast/app#mfe:proxy");
    expect(rootPackageJson.scripts.dev).not.toContain("-F @lightfast/app-next");
    expect(rootPackageJson.scripts.dev).not.toContain(
      "@lightfast/app-next#mfe:proxy"
    );
  });

  it("carries the canonical MFE mesh and proxy dependency", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(appRoot, "package.json"), "utf8")
    ) as {
      dependencies: Record<string, string | undefined>;
      scripts: Record<string, string | undefined>;
    };

    expect(existsSync(resolve(appRoot, "microfrontends.json"))).toBe(true);
    expect(packageJson.scripts["mfe:proxy"]).toContain(
      "microfrontends proxy ./microfrontends.json"
    );
    expect(packageJson.dependencies["@vercel/microfrontends"]).toBeDefined();
  });

  it("injects aggregate app URLs into the direct TanStack dev server", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(appRoot, "package.json"), "utf8")
    ) as {
      dependencies: Record<string, string | undefined>;
      scripts: Record<string, string | undefined>;
    };

    expect(packageJson.scripts["with-related-projects"]).toContain(
      "NEXT_PUBLIC_APP_URL=$(portless get lightfast)"
    );
    expect(packageJson.scripts["with-related-projects"]).toContain(
      "VITE_LIGHTFAST_APP_URL=$(portless get lightfast)"
    );
  });

  it("uses the existing lightfast-app Vercel project and env graph", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(appRoot, "package.json"), "utf8")
    ) as { scripts: Record<string, string> };
    const setupScript = readFileSync(
      resolve(repoRoot, "scripts/cloud/setup.sh"),
      "utf8"
    );

    expect(packageJson.scripts["with-env"]).toContain(
      "./.vercel/.env.development.local"
    );
    expect(packageJson.scripts["with-env:local"]).toContain(
      "./.vercel/.env.development.local"
    );
    expect(setupScript).toContain(
      "apps/app|lightfast-app|LIGHTFAST_VERCEL_PROJECT_ID_APP"
    );
    expect(setupScript).not.toContain("apps/app-next|");
  });

  it("declares TanStack Start on the canonical app Vercel project", () => {
    const tanstackVercelJson = JSON.parse(
      readFileSync(resolve(appRoot, "vercel.json"), "utf8")
    ) as {
      framework: string;
      relatedProjects: string[];
    };

    expect(tanstackVercelJson.framework).toBe("tanstack-start");
    expect(tanstackVercelJson.relatedProjects).toEqual([
      "prj_JRXRxBruTvB5Bs99JjA63TLek6GT",
    ]);
  });
});
