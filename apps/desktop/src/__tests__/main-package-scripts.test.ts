import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface PackageJson {
  scripts: Record<string, string | undefined>;
}

const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8")
) as PackageJson;

describe("package lifecycle scripts", () => {
  it("rebuilds native sqlite for Electron before dev starts", () => {
    expect(packageJson.scripts.predev).toBe("pnpm rebuild:sqlite");
    expect(packageJson.scripts.dev).toContain("electron-forge start");
  });

  it("rebuilds native sqlite for host Node before Vitest starts", () => {
    expect(packageJson.scripts.pretest).toBe("pnpm rebuild:sqlite:node");
    expect(packageJson.scripts.test).toBe("vitest run");
  });
});
