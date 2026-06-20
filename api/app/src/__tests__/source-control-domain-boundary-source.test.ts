import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");

function source(path: string) {
  return readFileSync(resolve(repoRoot, "api/app", path), "utf8");
}

describe("source-control domain boundary", () => {
  it("keeps GitHub runtime wiring outside the domain command module", () => {
    const commandSource = source("src/domain/source-control/commands.ts");
    const tanstackAdapterSource = source(
      "src/adapters/tanstack/source-control.ts"
    );

    expect(commandSource).not.toContain("@lightfast/connector-github/node");
    expect(commandSource).not.toContain(
      "createDefaultSourceControlCommandDeps"
    );
    expect(tanstackAdapterSource).toContain(
      "../../services/github/source-control/command-deps"
    );
  });
});
