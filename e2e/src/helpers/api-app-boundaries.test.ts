import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const e2eRoot = resolve(import.meta.dirname, "../..");
const forbiddenApiAppServicesSpecifier = `@api/app/${"services"}/`;

function e2eSourceFiles(dir = resolve(e2eRoot, "src")): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absPath = resolve(dir, entry.name);

    if (entry.isDirectory()) {
      return e2eSourceFiles(absPath);
    }

    return /\.(?:ts|tsx)$/.test(entry.name) ? [absPath] : [];
  });
}

describe("e2e architecture boundaries", () => {
  it("does not import api/app backend service internals", () => {
    const offenders = e2eSourceFiles()
      .map((path) => ({
        path: relative(e2eRoot, path),
        source: readFileSync(path, "utf8"),
      }))
      .filter(({ source }) =>
        source.includes(forbiddenApiAppServicesSpecifier)
      );

    expect(offenders.map(({ path }) => path)).toEqual([]);
  });
});
