import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packageRoot = resolve(import.meta.dirname, "../..");

function readSource(relativePath: string) {
  return readFileSync(resolve(packageRoot, relativePath), "utf8");
}

describe("observability knip ratchet", () => {
  it("does not keep unused Sentry entrypoints, exports, or React deps", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(packageRoot, "package.json"), "utf8")
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      exports?: Record<string, unknown>;
    };

    expect(packageJson.exports).not.toHaveProperty("./sentry");
    expect(packageJson.exports).not.toHaveProperty(
      "./sentry-electron-renderer"
    );
    expect(packageJson.dependencies?.react).toBeUndefined();
    expect(packageJson.devDependencies?.["@types/react"]).toBeUndefined();
    expect(existsSync(resolve(packageRoot, "src/sentry.ts"))).toBe(false);
    expect(
      existsSync(resolve(packageRoot, "src/sentry-electron-renderer.ts"))
    ).toBe(false);

    expect(readSource("src/sentry-browser.ts")).not.toContain("init");
    expect(readSource("src/sentry-electron-main.ts")).not.toContain(
      "captureMessage"
    );
    expect(readSource("src/sentry-nextjs.ts")).not.toContain("captureMessage");
    expect(readSource("src/context.ts")).not.toContain("enrichContext");
    expect(readSource("src/log/next.ts")).not.toContain("export type Logger");
  });
});
