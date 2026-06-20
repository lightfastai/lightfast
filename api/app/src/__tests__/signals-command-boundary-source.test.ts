import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(import.meta.dirname, "..");

describe("signal command creation boundary", () => {
  it("keeps signal commands framework-neutral and removes wrapper services", () => {
    const commandSource = readFileSync(
      resolve(apiRoot, "domain/signals/commands.ts"),
      "utf8"
    );
    const tanstackAdapterSource = readFileSync(
      resolve(apiRoot, "adapters/tanstack/signals.ts"),
      "utf8"
    );

    expect(commandSource).not.toContain("@db/app");
    expect(commandSource).not.toContain("../../signals/create-signal");
    expect(commandSource).not.toContain("../../signals/service");
    expect(tanstackAdapterSource).toContain("@db/app");
    expect(tanstackAdapterSource).toContain("../../signals/create-signal");
    expect(existsSync(resolve(apiRoot, "signals/service.ts"))).toBe(false);
  });
});
