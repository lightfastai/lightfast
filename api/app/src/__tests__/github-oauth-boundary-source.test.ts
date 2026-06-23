import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(import.meta.dirname, "..");

function source(path: string) {
  return readFileSync(resolve(apiRoot, path), "utf8");
}

describe("GitHub OAuth request boundary", () => {
  it("imports concrete GitHub OAuth services instead of the broad GitHub barrel", () => {
    const adapterSource = source("adapters/internal/github-oauth.ts");

    expect(adapterSource).toContain('../../services/github/setup/flow"');
    expect(adapterSource).toContain('../../services/github/user-account/flow"');
    expect(adapterSource).not.toContain('../../services/github"');
  });

  it("does not keep a broad GitHub service barrel", () => {
    expect(existsSync(resolve(apiRoot, "services/github/index.ts"))).toBe(
      false
    );
  });
});
