import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const apiRoot = resolve(repoRoot, "api/app");

function source(path: string) {
  return readFileSync(resolve(apiRoot, path), "utf8");
}

describe("GitHub setup domain boundary", () => {
  it("keeps GitHub runtime wiring outside the domain command module", () => {
    const commandSource = source("src/domain/github-setup/commands.ts");
    const tanstackAdapterSource = source(
      "src/adapters/tanstack/github-setup.ts"
    );

    expect(commandSource).not.toContain("@lightfast/connector-github/node");
    expect(commandSource).not.toContain("createDefaultGitHubSetupCommandDeps");
    expect(tanstackAdapterSource).toContain(
      "../../services/github/setup/command-deps"
    );
  });
});
