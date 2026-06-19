import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(import.meta.dirname, "..");

describe("signal command creation boundary", () => {
  it("keeps actor attribution in signal commands and removes the wrapper service", () => {
    const commandSource = readFileSync(
      resolve(apiRoot, "domain/signals/commands.ts"),
      "utf8"
    );

    expect(commandSource).toContain("../../signals/create-signal");
    expect(commandSource).not.toContain("../../signals/service");
    expect(existsSync(resolve(apiRoot, "signals/service.ts"))).toBe(false);
  });
});
