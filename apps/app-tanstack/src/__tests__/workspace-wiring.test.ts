import { readFileSync } from "node:fs";
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

  it("is included in root pnpm dev", () => {
    const rootPackageJson = JSON.parse(
      readFileSync(resolve(repoRoot, "package.json"), "utf8")
    ) as { scripts: Record<string, string> };

    expect(rootPackageJson.scripts.dev).toContain("-F @lightfast/app-tanstack");
    expect(rootPackageJson.scripts.dev).toContain(
      "@lightfast/app-tanstack#mfe:proxy"
    );
    expect(rootPackageJson.scripts.dev).not.toContain(
      "@lightfast/app#mfe:proxy"
    );
  });

  it("owns the default MFE mesh for the aggregate app URL", () => {
    const microfrontendsJson = readFileSync(
      resolve(appRoot, "microfrontends.json"),
      "utf8"
    );

    expect(microfrontendsJson).toContain(
      '"packageName": "@lightfast/app-tanstack"'
    );
    expect(microfrontendsJson).toContain('"packageName": "@lightfast/www"');
  });

  it("injects aggregate app URLs into the TanStack dev server", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(appRoot, "package.json"), "utf8")
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts["mfe:proxy"]).toContain(
      "lightfast-app-tanstack=$(portless get app-tanstack.lightfast)"
    );
    expect(packageJson.scripts["with-related-projects"]).toContain(
      "NEXT_PUBLIC_APP_URL=$(portless get lightfast)"
    );
    expect(packageJson.scripts["with-related-projects"]).toContain(
      "VITE_LIGHTFAST_APP_URL=$(portless get lightfast)"
    );
  });

  it("is included in cloud Vercel project hydration", () => {
    const setupScript = readFileSync(
      resolve(repoRoot, "scripts/cloud/setup.sh"),
      "utf8"
    );

    expect(setupScript).toContain("LIGHTFAST_VERCEL_PROJECT_ID_APP_TANSTACK");
    expect(setupScript).toContain(
      "apps/app-tanstack|lightfast-app-tanstack|LIGHTFAST_VERCEL_PROJECT_ID_APP_TANSTACK"
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
