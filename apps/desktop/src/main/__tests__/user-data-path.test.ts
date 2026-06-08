import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveUserDataPath } from "../user-data-path";

describe("resolveUserDataPath", () => {
  it("uses lowercase stable directories for normal app identities", () => {
    expect(resolveUserDataPath("/app-data", true)).toBe(
      join("/app-data", "lightfast")
    );
    expect(resolveUserDataPath("/app-data", false)).toBe(
      join("/app-data", "lightfast-local")
    );
  });

  it("isolates explicit dev instances under lightfast-local", () => {
    expect(resolveUserDataPath("/app-data", false, "worktree one")).toBe(
      join("/app-data", "lightfast-local", "instances", "worktree-one")
    );
  });

  it("ignores instance ids for packaged builds", () => {
    expect(resolveUserDataPath("/app-data", true, "worktree one")).toBe(
      join("/app-data", "lightfast")
    );
  });
});
