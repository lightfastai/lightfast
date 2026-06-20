import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const apiRoot = resolve(repoRoot, "api/app");

function source(path: string) {
  return readFileSync(resolve(apiRoot, path), "utf8");
}

describe("user connectors domain boundary", () => {
  it("keeps Granola service wiring outside the domain command module", () => {
    const commandSource = source("src/domain/user-connectors/commands.ts");
    const tanstackAdapterSource = source(
      "src/adapters/tanstack/user-connectors.ts"
    );

    expect(commandSource).not.toContain(
      "../../services/user-connectors/granola-flow"
    );
    expect(commandSource).not.toContain(
      "createDefaultUserConnectorCommandDeps"
    );
    expect(tanstackAdapterSource).toContain(
      "../../services/user-connectors/granola-flow"
    );
  });
});
