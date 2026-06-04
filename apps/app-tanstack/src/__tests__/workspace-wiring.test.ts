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
  });

  it("does not replace the current app in the MFE mesh", () => {
    const microfrontendsJson = readFileSync(
      resolve(repoRoot, "apps/app/microfrontends.json"),
      "utf8"
    );

    expect(microfrontendsJson).toContain('"packageName": "@lightfast/app"');
    expect(microfrontendsJson).not.toContain("@lightfast/app-tanstack");
  });
});
